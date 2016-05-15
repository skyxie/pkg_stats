"use strict";

const Path = require('path');
const Url = require('url');
const Zlib = require('zlib');
const Http = require('http');
const Stream = require('stream');

/**
 * SizeStream
 *
 * Writable stream that calculates total bytes written to stream.
 */
class SizeStream extends Stream.Writable {
  constructor() {
    super();
    this._size = 0;
  }

  _write(chunk, encoding, next) {
    let chunkSize = chunk.length;
    this._size += chunkSize;
    next();
  }

  size() { return this._size; }
}

/**
 * UrlSizeRunner
 *
 * Object to send a request to a given URL and measures the size of the URL
 * Sends request to URL with header: Accept-Encoding: gzip,deflate
 *
 * If the response comes back with header: Content-Encoding: gzip (or deflate)
 * then the response body is decompressed through gunzip (or inflate)
 *
 * The size of the compressed and uncompressed response is mesaured by piping
 * the streams to SizeStream objects.
 *
 * @params {string} url - URL to request 
 */
class UrlSizeRunner {
  constructor(url) {
    this.url = url;
    this.encodedStream = new SizeStream();
    this.actualStream = new SizeStream();
  }

  run(callback) {
    let self = this;
    let urlObj = Url.parse(self.url);
    let options = {
      'hostname' : urlObj.hostname,
      'port' : urlObj.port,
      'path' : urlObj.path,
      'headers' : {
        'accept-encoding' : 'gzip,deflate'
      }
    };

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

    self.actualStream.on('finish', () => { callback(null, self); });
  }

  encodedSize() { return this.encodedStream.size(); }
  actualSize() {  return this.actualStream.size(); }
}

module.exports = UrlSizeRunner;
