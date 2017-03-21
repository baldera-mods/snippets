var png = require('pngjs').PNG;

function getColors(data) {
  var out = [];
  for (var i = 0, len = data.length; i < len; i += 3) {
    out.push(data.slice(i, i+3));
  }
  return out;
}

module.exports = function() {};
module.exports.convert = function(data, cb) {
  // check header
  if (data.slice(0, 4).toString() !== 'TERA') {
    console.error('unknown image format');
    console.error(data.toString('hex'));
    process.nextTick(function() {
      cb(new Error('unknown image format'));
    });
    return;
  }

  var version = data.readInt32LE(4);
  var size = data.readInt32LE(8);
  var type = data.readInt32LE(12);
  var img = new png({ width: size, height: size });

  switch (type) {
    case 0: // palette (max 256 colors)
    case 1: // (+ extra chunk?)
      var numColors = data.readInt32LE(16);
      var offset = 20 + numColors * 3;
      var colors = getColors(data.slice(20, offset));
      var numPixels = data.readInt32LE(offset);
      var pixels = data.slice(offset + 4, offset + 4 + numPixels);
      for (var i = 0, len = pixels.length; i < len; i++) {
        colors[pixels[i]].copy(img.data, i * 4);
        img.data[i * 4 + 3] = 0xFF;
      }
      break;

    case 2: // grayscale
    case 3: // (+ extra chunk?)
      var numPixels = data.readInt32LE(16);
      var pixels = data.slice(20, 20 + numPixels);
      for (var i = 0, len = pixels.length; i < len; i++) {
        img.data.fill(pixels[i], i * 4, i * 4 + 3);
        img.data[i * 4 + 3] = 0xFF;
      }
      break;

    default:
      console.error('unknown type %d', type);
      console.error(data.toString('hex'));
      img = null;
      process.nextTick(function() {
        cb(new Error('unknown type'));
      });
      return;
  }

  var buffers = [];
  img.pack()
    .on('data', function(buf) {
      buffers.push(buf);
    })
    .on('end', function() {
      cb(null, Buffer.concat(buffers));
    });
};
