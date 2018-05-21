// Will be moved to separate github repo


import sha256 from 'js-sha256';


function appendBuffer(buffer1, buffer2) {
  var tmp = new Uint8Array(buffer1.byteLength + buffer2.byteLength);
  tmp.set(new Uint8Array(buffer1), 0);
  tmp.set(new Uint8Array(buffer2), buffer1.byteLength);
  return tmp.buffer;
}


export function zero_hash(row) {
    let string_fields = ['vin', 'description'];
    let number_fields = ['odometer'];
    let date_fields = ['created_at'];
    let row_bytes = new ArrayBuffer(0);

    for (let i = 0; i < string_fields.length; i++) {
        if (row[string_fields[i]] === null) continue;
        row_bytes = appendBuffer(row_bytes, Buffer.from(row[string_fields[i]], 'utf8'));
    }

    for (let i = 0; i < number_fields.length; i++) {
        if (row[number_fields[i]] === null) continue;
        let value_buffer = new ArrayBuffer(8);
        let value_view = new DataView(value_buffer);
        value_view.setFloat64(0, row[number_fields[i]]);

        let reverse_buffer = new Uint8Array(value_buffer);
        reverse_buffer.reverse();

        row_bytes = appendBuffer(row_bytes, value_buffer);
    }

    for (let i = 0; i < date_fields.length; i++) {
        if (row[date_fields[i]] === null) continue;
        row_bytes = appendBuffer(row_bytes, Buffer.from(row[date_fields[i]], 'utf8'));
    }

    return sha256(row_bytes)
}


export function vinchain_hash(row) {
    let string_fields = [
        'auction', 'hash', 'lot', 'location_state', 'pickup_location', 'sale_date', 'year', 'make', 'model', 'vin',
        'odometer', 'trim_level', 'in_service_date', 'fuel_type', 'engine', 'displacement', 'transmission',
        'exterior_color', 'interior_color', 'window_sticker', 'body_style', 'doors', 'vehicle_type', 'salvage',
        'as_is', 'title_state', 'title_status', 'drive_train', 'interior_type', 'top_type', 'stereo', 'airbags'
    ];
    let number_fields = ['dealer_id', 'price'];
    let date_fields = ['create_date', 'saledate'];
    let row_bytes = new ArrayBuffer(0);

    for (let i = 0; i < string_fields.length; i++) {
        if (row[string_fields[i]] === null) continue;
        row_bytes = appendBuffer(row_bytes, Buffer.from(row[string_fields[i]], 'utf8'));
    }

    for (let i = 0; i < number_fields.length; i++) {
        if (row[number_fields[i]] === null) continue;
        let value_buffer = new ArrayBuffer(8);
        let value_view = new DataView(value_buffer);
        value_view.setFloat64(0, row[number_fields[i]]);

        let reverse_buffer = new Uint8Array(value_buffer);
        reverse_buffer.reverse();

        row_bytes = appendBuffer(row_bytes, value_buffer);
    }

    for (let i = 0; i < date_fields.length; i++) {
        if (row[date_fields[i]] === null) continue;
        row_bytes = appendBuffer(row_bytes, Buffer.from(row[date_fields[i]], 'utf8'));
    }

    return sha256(row_bytes)
}

const hash_functions = {
    0: zero_hash,
    1: vinchain_hash,
};

export default hash_functions;
