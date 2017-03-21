// requires
const fs = require('fs');
const zlib = require('zlib');
const protobuf = require('protobufjs');

// globals
const root = protobuf.loadSync(__dirname + '/formats.proto');
const proto = root.lookup('Settings');

// helpers
function convert(data, func, type = data.$type) {
  if (!data || !type) return;

  for (const field of type.fieldsArray) {
    const { name, resolvedType, repeated, comment } = field;
    const val = data[name];
    if (!val) continue;

    if (resolvedType) { // TODO check for enum type
      if (repeated) {
        for (const elem of val) {
          convert(elem, func, resolvedType);
        }
      } else {
        convert(val, func, resolvedType);
      }
    } else if (comment === 'wchar') {
      data[name] = repeated
        ? val.map(func)
        : func(val);
    }
  }
}

function convertFromWchar(data) {
  convert(data, buf => buf.toString('utf16le'), data.$type);
}

function convertToWchar(data, type) {
  convert(data, str => Buffer.from(str, 'utf16le'), type);
}

module.exports = function() {};

Object.assign(module.exports, {
  parse(buf) {
    const settings = proto.decode(buf);
    convertFromWchar(settings);

    for (const group of settings.data) {
      if (group.zipped) {
        group.data = zlib.inflateSync(group.data);
      }

      if (group.data.length !== group.length) {
        console.warn(`settings group "${group.name}" size: ${group.data.length} (expected: ${group.length}, zipped: ${group.zipped})`);
      }

      try {
        const message = root.lookup(group.name);
        const data = message.decode(group.data);
        convertFromWchar(data);
        group.data = data;
      } catch (err) {}
    }

    return settings;
  },

  build(obj) {
    // TODO clone to avoid overwriting original

    for (const group of obj.data) {
      const message = root.lookup(group.name);
      convertToWchar(group.data, message);
      group.data = message.encode(group.data).finish();
      group.length = group.data.length;
      if (group.zipped) {
        group.data = zlib.deflateSync(group.data);
      }
    }

    convertToWchar(obj, proto);
    return proto.encode(obj).finish();
  },
});
