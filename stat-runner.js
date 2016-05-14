
const Path = require('path');
const Url = require('url');
const ChildProcess = require('child_process');
const PhantomJS = require('phantomjs-prebuilt')
const Async = require('async');
const _ = require('underscore');

const UrlSizeRunner = require(Path.join(__dirname, 'url-size-runner'));

class StatRunner {
  constructor(url, enc, phantom) {
    this.url = url;
    this.enc = enc;
    this.phantom = phantom;
  }

  run(callback) {
    var self = this;

    var tasks = [
      callback => StatRunner._spawnPhantom(self.url, callback),
      (json, callback) => StatRunner._parseJSON(json, callback),
      (phantomResults, callback) => StatRunner._uniquePhantomResults(phantomResults, callback),
      (uniquePhantomResults, callback) => StatRunner._createUrlSizeRunners(uniquePhantomResults, callback)
    ];

    if (typeof self.enc == 'string' || !self.phantom) {
      tasks.push((urlSizeRunners, callback) => StatRunner._runUrlSizeRequests(urlSizeRunners, callback));
    }

    Async.waterfall(
      tasks,
      (err, results) => {
        if (err) {
          callback(err);
        } else {
          callback(null, StatRunner.format(results));
        }
      }
    );
  }

  static format(results) {
    return _.reduce(
      results,
      (memo, result) => {
        if (!_.has(memo, result.url)) {
          memo[result.url] = {};
        }
        memo[result.url].encoded_size = result.encodedSize();
        memo[result.url].actual_size = result.actualSize();
        memo[result.url].phantom_size = result.phantomSize();
        return memo;
      },
      {}
    )
  }

  static _runUrlSizeRequests(urlSizeRunners, callback) {
    Async.parallel(
      _.map(
        urlSizeRunners,
        (runner) => {
          return (callback) => runner.run(callback);
        }
      ),
      (err, results) => {
        if (err) {
          callback(err);
        } else {
          callback(null, results);
        }
      }
    );
  }

  static _spawnPhantom(url, callback) {
    var phantomJsPath = PhantomJS.path,
        phantomJsArgs = [Path.join(__dirname, 'phantomjs-stats.js'), url];

    var child = ChildProcess.execFile(phantomJsPath, phantomJsArgs);
    var data = '';

    child.on('error', (err) => { callback(err); });

    child.stdout.on('data', (chunk) => {
      data += chunk;
    });

    child.on('exit', (code, signal) => {
      if (code == 0) {
        callback(null, data);
      } else {
        callback(new Error("Failed to collect stats with PhantomJS: "+phantomJsPath+" "+phantomJsArgs.join(" ")));
      }
    });
  }

  static _parseJSON(json, callback) {
    var result;

    try {
      result = JSON.parse(json);
    } catch (e) {
      callback(new Error("Could not parse JSON from: "+json+" - "+e.message));
      return;
    }

    callback(null, result);
  }

  static _uniquePhantomResults(phantomResults, callback) {
    let uniquePhantomResults = _.reduce(
      phantomResults,
      (memo, phantomResult) => {
        let key = phantomResult.url;
        if (!_.has(memo, key) || (!memo[key].bodySize && phantomResult.bodySize)) {
          memo[key] = phantomResult;
        }
        return memo;
      },
      {}
    );

    callback(null, _.values(uniquePhantomResults));
  }

  static _createUrlSizeRunners(phantomResults, callback) {
    let urlSizeRunners = _.map(
      phantomResults,
      (phantomResult) => {
        let contentEncoding;
        let contentEncodingHeader = _.find(
          phantomResult.headers,
          header => header.name == "Content-Encoding"
        );
        if (contentEncodingHeader) {
          contentEncoding = contentEncodingHeader.value;
        }

        return new UrlSizeRunner(phantomResult.url, phantomResult.bodySize, contentEncoding);
      }
    );

    callback(null, urlSizeRunners);
  }
}

module.exports = StatRunner;
