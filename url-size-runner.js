
const Path = require('path');
const Url = require('url');
const Zlib = require('zlib');
const Http = require('http');
const Stream = require('stream');

class SizeStream extends Stream.Writable {
  constructor(url, type) {
    super();
    this._size = 0;
    this._url = url;
    this._type = type;
  }

  _write(chunk, encoding, next) {
    let chunkSize = chunk.length;
    this._size += chunkSize;
    next();
  }

  size() {
    return this._size;
  }
}

class UrlSizeRunner {
  constructor(url, phantomSize, contentEncoding) {
    this.url = url;
    this._phantomSize = phantomSize;
    this.contentEncoding = contentEncoding;

    this.encodedStream = new SizeStream(url, 'encoded');
    this.actualStream = new SizeStream(url, 'actual');
  }

  run(callback) {
    let self = this;
    let urlObj = Url.parse(self.url);
    let options = {
      'hostname' : urlObj.hostname,
      'port' : urlObj.port,
      'path' : urlObj.path
    };

    if (self.contentEncoding) {
      options.headers = {'accept-encoding' : self.contentEncoding};
    }

    let request = Http.get(options);

    request.end();

    request.on('error', err => callback(err));

    request.on('response', (response) => {
      response.pipe(self.encodedStream);
      if (response.headers['content-encoding'] == 'gzip') {
        let gunzip = Zlib.createGunzip();
        response.pipe(gunzip).pipe(self.actualStream);
      } else if (response.headers['content-encoding'] == 'deflate') {
        let inflate = Zlib.createInflate();
        response.pipe(inflate).pipe(self.actualStream);
      } else {
        response.pipe(self.actualStream);
      }
    });

    self.actualStream.on('finish', () => {
      callback(null, self);
    });
  }

  phantomSize() {
    return this._phantomSize;
  }

  encodedSize() {
    return this.encodedStream.size();
  }

  actualSize() {
    return this.actualStream.size();
  }
}

module.exports = UrlSizeRunner;
