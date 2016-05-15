
"use strict";

const Path = require('path');
const Stream = require('stream');
const EventEmitter = require('events').EventEmitter;
const Http = require('http');
const Zlib = require('zlib');
const FS = require('fs');

const Sinon = require('Sinon');
const Chai = require('chai');
const expect = Chai.expect;
const should = Chai.should();
const _ = require('underscore');

const UrlSizeRunner = require(Path.join(__dirname, '..', 'lib', 'url-size-runner'));

describe('UrlSizeRunner', () => {
  afterEach(() => {
    Http.get.restore();
  });

  it('should send request with expected options and callback with error on request error', (done) => {
    let stubReq = new EventEmitter();
    stubReq.end = () => { };

    Sinon.stub(Http, 'get', (options) => {
      options.hostname.should.equal('foo.com');
      options.path.should.equal('/bar?fizz=buzz');
      options.headers.should.eql({'accept-encoding' : 'gzip,deflate'});
      return stubReq;
    });

    let runner = new UrlSizeRunner('http://foo.com/bar?fizz=buzz');
    runner.run((err, result) => {
      should.exist(err);
      err.message.should.equal('oops');
      done();
    });

    stubReq.emit('error', new Error('oops'));
  });

  it('should pipe response into encodedStream and actualStream', (done) => {
    let stubReq = new EventEmitter();
    stubReq.end = () => { };

    Sinon.stub(Http, 'get', (options) => stubReq);

    let runner = new UrlSizeRunner('http://foo.com/bar?fizz=buzz');
    runner.run((err, result) => {
      should.not.exist(err);
      result.encodedSize().should.equal(8);
      result.actualSize().should.equal(8);
      done();
    });

    let response = FS.createReadStream(Path.join(__dirname, 'fixtures', 'test'));
    response.headers = {};

    stubReq.emit('response', response);
  });

  it('should pipe response into encodedStream and actualStream', (done) => {
    let stubReq = new EventEmitter();
    stubReq.end = () => { };

    Sinon.stub(Http, 'get', (options) => stubReq);

    let runner = new UrlSizeRunner('http://foo.com/bar?fizz=buzz');
    runner.run((err, result) => {
      should.not.exist(err);
      result.encodedSize().should.equal(33);
      result.actualSize().should.equal(8);
      done();
    });

    let response = FS.createReadStream(Path.join(__dirname, 'fixtures', 'test.gz'));
    response.headers = {"content-encoding" : "gzip"};

    stubReq.emit('response', response);
  });
});
