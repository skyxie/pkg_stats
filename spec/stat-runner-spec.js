
"use strict";

const Path = require('path');
const ChildProcess = require('child_process');
const Stream = require('stream');
const EventEmitter = require('events').EventEmitter;
const Sinon = require('Sinon');
const Chai = require('chai');
const expect = Chai.expect;
const should = Chai.should();
const _ = require('underscore');

const UrlSizeRunner = require(Path.join(__dirname, '..', 'lib', 'url-size-runner'));
const StatRunner = require(Path.join(__dirname, '..', 'lib', 'stat-runner'));

describe('StatRunner', () => {
  describe('_spawnPhantom', function() {
    let childStub;

    beforeEach(() => {
      childStub = new EventEmitter();
      childStub.stdout = new EventEmitter();
      Sinon.stub(ChildProcess, 'execFile', (path, args) => childStub);
    });

    afterEach(() => {
      ChildProcess.execFile.restore();
    });

    it('should callback with error on error spawning process', (done) => {
      StatRunner._spawnPhantom('http://somewhere.com', 1234, (err, result) => {
        should.exist(err);
        err.message.should == 'oops';
        done();
      });

      childStub.emit('error', new Error("oops"));
    });

    it('should callback with error on non-zero exit code', (done) => {
      StatRunner._spawnPhantom('http://somewhere.com', 1234, (err, result) => {
        should.exist(err);
        err.message.should.match(/^Failed to collect stats with PhantomJS:/);
        done();
      });

      childStub.emit('exit', 1, null);
    });

    it('should callback with stdout', (done) => {
      StatRunner._spawnPhantom('http://somewhere.com', 1234, (err, result) => {
        should.not.exist(err);
        result.should.equal('abcdef');
        done();
      });

      childStub.stdout.emit('data', 'abcdef');

      childStub.emit('exit', 0);
    });
  });

  describe('_parseJSON', () => {
    it('should callback with error on invalid json', (done) => {
      StatRunner._parseJSON("oo':'b", (err, result) => {
        should.exist(err);
        err.message.should.match(/^Could not parse JSON from: oo':'b/);
        done();
      });
    });

    it('should callback with parsed json', (done) => {
      StatRunner._parseJSON(JSON.stringify({'foo':'bar'}), (err, result) => {
        should.not.exist(err);
        result.should.eql({'foo':'bar'});
        done();
      });
    });
  });

  describe('_processPhantomResults', () => {
    it('should callback with object', (done) => {
      let phantomResults = [
        {
          "url" : "http://foo.com/bar.js",
          "contentType" : "application/javascript",
          "bodySize" : 123
        },
        {
          "url" : "http://foo.com/bar.js",
          "contentType" : "application/javascript"
        },
        {
          "url" : "http://foo.com/bar.css",
          "contentType" : "text/css",
          "bodySize" : 456
        }
      ];

      StatRunner._processPhantomResults(
        phantomResults,
        ["application/javascript"],
        (err, result) => {
          result.should.eql({"http://foo.com/bar.js" : {"phantom_size" : 123}});
          done();
        }
      )
    });
  });

  describe('_runUrlSizeRequests', () => {
    afterEach(() => {
      UrlSizeRunner.prototype.run.restore();
    });

    it('should callback with results from UrlSizeRunner', (done) => {
      Sinon.stub(UrlSizeRunner.prototype, "run", (callback) => {
        callback(null, {"url": "http://foo.com/bar.js", "encodedSize" : () => 124, "actualSize" : () => 125});
      });

      let uniquePhantomResults = {"http://foo.com/bar.js" : {"phantom_size" : 123}};

      StatRunner._runUrlSizeRequests(uniquePhantomResults, (err, result) => {
        should.not.exist(err);
        result.should.eql({
          "http://foo.com/bar.js" : {
            "phantom_size" : 123,
            "encoded_size" : 124,
            "actual_size" : 125
          }
        });
        done();
      });
    });

    it('should callback with error on UrlSizeRunner error', (done) => {
      Sinon.stub(UrlSizeRunner.prototype, "run", (callback) => {
        callback(new Error("oops"));
      });

      let uniquePhantomResults = {"http://foo.com/bar.js" : {"phantom_size" : 123}};

      StatRunner._runUrlSizeRequests(uniquePhantomResults, (err, result) => {
        should.exist(err);
        err.message.should.equal("oops");
        done();
      });
    });
  });

  describe('run', () => {
    it('should pass through each method', (done) => {
      let phantomResults = [
        {
          "url" : "http://foo.com/bar.js",
          "contentType" : "application/javascript",
          "bodySize" : 123
        },
        {
          "url" : "http://foo.com/bar.js",
          "contentType" : "application/javascript"
        },
        {
          "url" : "http://foo.com/bar.css",
          "contentType" : "text/css",
          "bodySize" : 456
        }
      ];

      Sinon.stub(StatRunner, "_spawnPhantom", (u, t, cb) => {
        u.should.equal("http://foo.com/bar.js");
        t.should.equal(123);
        cb(null, JSON.stringify(phantomResults));
      });

      Sinon.stub(UrlSizeRunner.prototype, "run", (callback) => {
        callback(null, {"url": "http://foo.com/bar.js", "encodedSize" : () => 124, "actualSize" : () => 125});
      });

      let statRunner = new StatRunner("http://foo.com/bar.js", 123, ["application/javascript"]);
      statRunner.run((err, result) => {
        StatRunner._spawnPhantom.restore();
        UrlSizeRunner.prototype.run.restore();

        result.should.eql({
          "http://foo.com/bar.js" : {
            "phantom_size" : 123,
            "encoded_size" : 124,
            "actual_size" : 125
          }
        });

        done();
      });
    });
  });
});