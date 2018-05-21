import React, { Component } from 'react';
import axios from 'axios';
import hash_functions from './vinchain_hashing';
import {Apis} from "bitsharesjs-ws";
import { BrowserRouter as Router, Route, Link } from "react-router-dom";
import appConfig from "./Config";


class ReportVerifierForm extends Component {
    constructor(props) {
        super(props);
        this.state = {
            report: ''
        };

        this.handleChange = this.handleChange.bind(this);
        this.handleSubmit = this.handleSubmit.bind(this);
    }

    handleChange(event) {
        this.setState({report: event.target.value});
    }

    resultOk(message, ret) {
        document.getElementById('verification-result').innerHTML += "<p>" + message + "&nbsp;<span style=\"color:green;\">OK</span></p>";
    }

    resultFail(message, ret) {
        document.getElementById('verification-result').innerHTML += "<p>" + message + "&nbsp;<span style=\"color:red;\">FAIL</span></p>";
    }

    resultInto(message, ret) {
        document.getElementById('verification-result').innerHTML += "<p>" + message + "</p>";
    }

    handleSubmit(event) {
        event.preventDefault();

        document.getElementById('verification-result-container').style.display = 'block';
        document.getElementById('verification-result').innerHTML = '<p>Verification started.</p>';

        try {
            let report = this.parseReportFromJson();
            let report_uuid = this.getReportUUID(report);
            let self = this;
            this.resultInto('Getting invoice from blockchain');

            Apis.instance().db_api().exec("get_invoice_by_report_uuid", [report_uuid]).then(function(invoice) {

                if (!invoice) {
                    self.resultFail("Invoice not found");
                    return;
                }

                self.resultOk("Invoice found");

                if(invoice.records.length != report.report.length) {
                    self.resultFail("Records count in invoice and in report don't match");
                    return;
                } else {
                    self.resultOk("Records count match");
                }

                self.checkRecords(report, invoice);
            });


        } catch (error) {
            console.log(error);
        }
    }

    parseReportFromJson() {
        try {
            let report = JSON.parse(this.state.report);
            this.resultOk('Report parsing');
            return report;
        } catch (error) {
            this.resultFail('Report parsing');
            throw error;
        }
    }

    getReportUUID(report) {
        try {
            let report_uuid = report.report_id;
            this.resultOk('Report ID:' + report_uuid);
            return report_uuid;
        } catch (error) {
            this.resultFail('Report ID not found');
            throw error;
        }
    }

    async checkRecords(report, invoice) {
        document.getElementById('verification-result').innerHTML += '<hr />';
        document.getElementById('verification-result').innerHTML += '<p>CHECK RECORDS:</p>';
        document.getElementById('verification-result').innerHTML += '<hr />';

        let self = this;

        for (let i = 0; i < report.report.length; i++) {
            try {
                let standard_version = report.report[i].blockchain_info.standard_version;
                let hash = hash_functions[standard_version](report.report[i]);

                let found_hash_in_invoice = false;
                for (let j = 0; j < invoice.records.length; j++) {
                    if (invoice.records[j].hash == hash) {
                        found_hash_in_invoice = true;
                    }
                }

                await axios.get(appConfig.VINCHAIN_VINDB + '/vindb/vin_records/', {
                    params: {
                        hash: hash
                    }
                })
                .then(async row_res => {
                    let row = row_res.data.results[0];

                    await axios.get(appConfig.VINCHAIN_VINDB + '/vindb/blocks/' + row.block + '/').then(async block_res => {
                        let block = block_res.data;

                        self.resultOk('Record has confirmed');

                        document.getElementById('verification-result').innerHTML += '<p>Record ' + (i + 1) + ' hash: ' + hash + '</p>';
                        document.getElementById('verification-result').innerHTML += '<p>Record address: <a target="_blank" href="/record/' + hash + '">/record/' + hash + '/</a></p>';
                        document.getElementById('verification-result').innerHTML += '<p>Record date: ' + row.created_at + '</p>';
                        document.getElementById('verification-result').innerHTML += '<p>Block ID: ' + row.block + '</p>';
                        document.getElementById('verification-result').innerHTML += '<p>Block date: ' + block.created_at + '</p>';

                        await Apis.instance().db_api().exec("get_vindb_blocks", [row.block, 1]).then(async blockchain_blocks => {
                            if (!blockchain_blocks.length || blockchain_blocks[0].block_hash != block.hash) {
                                self.resultFail('Block has confirmed');
                                return
                            }

                            self.resultOk('Block has confirmed');

                            document.getElementById('verification-result').innerHTML += '<p>Block adress: <a href="' + appConfig.VINCHAIN_WALLET + '/block/' + blockchain_blocks[0].block_num + '" target="_blank">' + appConfig.VINCHAIN_WALLET + '/block/' + blockchain_blocks[0].block_num + '</p>';
                        });
                    });

                }).catch(async err => {
                    this.resultFail("Record verification");
                });
            } catch (error) {
                    this.resultFail("Record verification");
                    console.log(error);
                }
            }
    }

    render() {
        return (
            <div>
                <h1>Verify report</h1>
                <form onSubmit={this.handleSubmit}>
                <div className="form_settings">
                    <p><textarea style={{width: '844px', height:'250px'}} onChange={this.handleChange}></textarea></p>
                    <p style={{paddingTop: '15px'}}>
                        <span>&nbsp;</span>
                        <input className="submit" type="submit" value="Verify"/>
                    </p>
                    </div>
                </form>
                <div id="verification-result-container" style={{display: 'none'}}>
                    <h1>Result</h1>
                    <div id="verification-result"></div>
                </div>
            </div>
        )
    }
}


class RecordView extends Component {
    constructor(props) {
        super(props);
        this.handleSubmit = (() => {return false}).bind(this);
        this.handleGo = (() => {
            document.location.href = '/record/' + document.getElementById("go").value;
            return false;
        }).bind(this);

        this.state = {
            loading: true,
            error404: false,
        };

        let self = this;

        axios.get(appConfig.VINCHAIN_VINDB + '/vindb/vin_records/', {
            params: {
                hash: this.props.match.params.hash
            }
        }).then(row_res => {
            console.log(row_res);
            if (!row_res.data.meta.count) {
                self.setState({
                    error404: true
                });
                return;
            }

            self.state.vindb_row = row_res.data.results[0];

            axios.get(appConfig.VINCHAIN_VINDB + '/vindb/blocks/' + self.state.vindb_row.block + '/').then(async block_res => {
                let block = block_res.data;
                self.state.vindb_block = block;

                if (typeof Apis.instance().db_api() === "undefined")
                    await Apis.instance(appConfig.VINCHAIN_NODE, true).init_promise;

                Apis.instance().db_api().exec("get_vindb_blocks", [block.id, 1]).then(blockchain_vindb_blocks => {
                    if (!blockchain_vindb_blocks.length) {
                        self.setState({
                            error404: true
                        });
                        return;
                    }

                    self.state.blockchain_vindb_block = blockchain_vindb_blocks[0];

                    axios.get(appConfig.VINCHAIN_VINDB + '/vindb/vin_records/', {
                        params: {
                            block: self.state.vindb_row.block,
                            page_size: 10000,
                        }
                    }).then(all_rows => {
                        self.state.all_rows = all_rows.data.results;

                        if (block.id == 1) {
                            self.state.previous_blockchain_vindb_block = {
                                block_num: 0,
                                created_at: "1970-01-01T00:00:00",
                                block_hash: "079007a0a67c73fac2ec6cf05d6fec97e3791a4b49d82f064c72961e05c7b37b"
                            };

                            self.state.loading = false;
                            self.setState({
                                loading: false
                            });
                        } else {
                            axios.get(appConfig.VINCHAIN_VINDB + '/vindb/blocks/' + (block.id-1) + '/').then(previous_block_res => {
                                let previuou_block = previous_block_res.data;
                                self.state.previous_vindb_block = previuou_block;

                                Apis.instance().db_api().exec("get_vindb_blocks", [previuou_block.id, 1]).then(previous_blockchain_vindb_blocks => {
                                    self.state.previous_blockchain_vindb_block = previous_blockchain_vindb_blocks[0];

                                    console.log(previous_blockchain_vindb_blocks[0]);

                                    self.state.loading = false;
                                    self.setState({
                                        loading: false
                                    });
                                });
                            });
                        }
                    });
                });
            });

        });
    }

    render() {
        let self = this;

        return (
            <div>
            {this.state.error404 ? (
                <div>
                    <h1>VinDB Data</h1>
                    <p>Not found</p>
                </div>
            ) : (
                <div>
                { this.state.loading ? (
                    <div>
                        <h1>VinDB Data</h1>
                        <p>Loading...</p>
                    </div>
                ) : (
                    <div>
                        <h1>VinDB Data</h1>
                        <p>
                            Record hash: <input id="go" type="text" defaultValue={this.props.match.params.hash}
                                                style={{width: '410px'}}/>&nbsp;<input type="button" value="Go"
                                                                                       onClick={this.handleGo}/>
                        </p>
                        <p>Block ID: <a
                            href={appConfig.VINCHAIN_WALLET + "/block/" + this.state.blockchain_vindb_block.block_num}
                            target="_blank">{this.state.vindb_row.block}</a></p>
                        <p>Block Hash: <a
                            href={appConfig.VINCHAIN_WALLET + "/block/" + this.state.blockchain_vindb_block.block_num}
                            target="_blank">{this.state.vindb_block.hash}</a></p>
                        <p>Block Date: {this.state.vindb_block.created_at}</p>
                        <hr/>
                        <div style={{width: '850px', height:'300px', overflow:'auto'}}>
                        <table>
                            <thead>
                            <tr>
                                <th>ID</th>
                                <th>Created at</th>
                                <th>VIN</th>
                                <th>Standard version</th>
                                <th>Value</th>
                                <th>Hash</th>
                                <th>Block ID</th>
                                <th>Data Source</th>
                                <th>UUID</th>
                            </tr>
                            </thead>
                            <tbody>
                            {this.state.all_rows.filter(object => object.hash === this.props.match.params.hash).map(function(object, i) {
                                return  <tr key={i}>
                                            <td>{object.id}</td>
                                            <td>{object.created_at}</td>
                                            <td>{object.vin}</td>
                                            <td>{object.standard_version}</td>
                                            <td>{object.value}</td>
                                            <td>{object.hash}</td>
                                            <td>{self.state.vindb_row.block}</td>
                                            <td>{object.data_source}</td>
                                            <td>{object.uuid}</td>
                                        </tr>
                            })}
                            {this.state.all_rows.filter(object => object.hash != this.props.match.params.hash).map(function(object, i) {
                                return  <tr key={i}>
                                            <td>{object.id}</td>
                                            <td>{object.created_at}</td>
                                            <td>{object.vin}</td>
                                            <td>{object.standard_version}</td>
                                            <td>{object.value}</td>
                                            <td>{object.hash}</td>
                                            <td>{self.state.vindb_row.block}</td>
                                            <td>{object.data_source}</td>
                                            <td>{object.uuid}</td>
                                        </tr>
                            })}
                            </tbody>
                        </table>
                        </div>
                        <p>Previous Block ID: <a
                            href={appConfig.VINCHAIN_WALLET + "/block/" + this.state.previous_blockchain_vindb_block.block_id}
                            target="_blank">{this.state.previous_blockchain_vindb_block.block_id}</a></p>
                        <p>Previous Block Hash: {this.state.previous_blockchain_vindb_block.block_hash}</p>
                        <p>Previous Block Date: {this.state.previous_vindb_block.created_at}</p>

                        <p>
                            Code for calculating hash:
                        </p>
                        <div style={{width: '850px', height:'300px', overflow:'auto'}}>
                            <code>
from hashlib import sha256<br />
from struct import pack<br />

block_hash = bytearray()<br />
block_hash += pack("&lt;Q", {this.state.previous_blockchain_vindb_block.block_id})<br />
block_hash += bytes("{this.state.previous_vindb_block.created_at}", "utf-8")<br />
block_hash += bytes("{this.state.previous_blockchain_vindb_block.block_hash}", "utf-8")<br />
block_hash += bytes("{this.state.vindb_block.created_at}", "utf-8")<br />
<br />
records = [<br />
{this.state.all_rows.map(function(object, i) {
    return '{"id": '+ object.id + ', "created_at": "' + object.created_at + '", "data_source": "' + object.data_source + '", "vin": "' + object.vin + '", "standard_version": ' + object.standard_version + ', "value": ' + object.value + ', "hash": "' + object.hash + '"}, ';
})}
<br />
]<br />
<br />
for record in records:<br />
&nbsp;&nbsp;&nbsp;&nbsp;record_ids.append(record['id'])<br />
<br />
&nbsp;&nbsp;&nbsp;&nbsp;block_hash += pack("&lt;Q", record['id'])<br />
&nbsp;&nbsp;&nbsp;&nbsp;block_hash += bytes(record['created_at'], 'utf-8')<br />
&nbsp;&nbsp;&nbsp;&nbsp;block_hash += bytes(record['data_source'], 'utf-8')<br />
&nbsp;&nbsp;&nbsp;&nbsp;block_hash += bytes(record['vin'], 'utf-8')<br />
&nbsp;&nbsp;&nbsp;&nbsp;block_hash += pack("&lt;Q", record['standard_version'])<br />
&nbsp;&nbsp;&nbsp;&nbsp;block_hash += pack("&lt;Q", record['value'])<br />
&nbsp;&nbsp;&nbsp;&nbsp;block_hash += bytes(record['hash'], 'utf-8')<br />
<br />
print(sha256(block_hash).hexdigest())

                            </code>
                        </div>
                    </div>
                )}
                </div>
            )}
            </div>
        );
    }
}


class App extends Component {
    constructor(props) {
        super(props);
        Apis.instance(appConfig.VINCHAIN_NODE, true);
    }

    render() {
        return (
            <Router>
                <div>
                    <Route exact path="/" component={ReportVerifierForm}/>
                    <Route exact path="/record/:hash" component={RecordView}/>
                </div>
            </Router>
        );
    }
}

export default App;
