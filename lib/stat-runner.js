"use strict";

const Path = require('path');
const Url = require('url');
const ChildProcess = require('child_process');
const PhantomJS = require('phantomjs-prebuilt')
const Async = require('async');
const _ = require('underscore');

const UrlSizeRunner = require(Path.join(__dirname, 'url-size-runner'));
const PhantomJSStats = Path.resolve(__dirname, '..', 'bin', 'phantomjs-stats.js');

/**
 * StatRunner
 *
 * This class will mesure the encoded and actual size of every resource loaded
 * (dynamically or statically) on a page.
 * 
 */
class StatRunner {
  constructor(url, timeout, contentTypes) {
    this.url = url;
    this.timeout = timeout;
    this.contentTypes = contentTypes;
  }

  run(callback) {
    Async.waterfall(
      [
        callback => StatRunner._spawnPhantom(this.url, this.timeout, callback),
        (json, callback) => StatRunner._parseJSON(json, callback),
        (phantomResults, callback) => StatRunner._processPhantomResults(phantomResults, this.contentTypes, callback),
        (uniquePhantomResults, callback) => StatRunner._runUrlSizeRequests(uniquePhantomResults, callback),
      ],
      callback
    );
  }

  /**
   * _spawnPhantom
   *
   * Spawns a PhantomJS process to run a headless web browser to load the given URL
   * PhantomJS script will output to STDOUT URL of each resource loaded on the given page
   * PhantomJS will also calculate the size of the resource, which is included in the output,
   * but this calculation is frequently incorrect.
   *
   * @param {string} url - URL to analyze
   * @param {int} timeout - ms to keep webpage open for dynamic loading
   * @param {function} callback - Callback function to call on completion
   *
   * @callback callback
   * @param {Error} err - Error code in case of failure
   * @param {string} data - Output read from STDOUT of spawns PhantomJS process  
   */
  static _spawnPhantom(url, timeout, callback) {
    let phantomJsPath = PhantomJS.path,
        phantomJsArgs = [PhantomJSStats, url, timeout];

    let child = ChildProcess.execFile(phantomJsPath, phantomJsArgs);
    let data = '';

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

  /**
   * _parseJSON
   *
   * Catches errors thrown by JSON parse and passes error and result to callback
   *
   * @param {string} json - JSON data output to parse
   * @param {function} callback - Callback method on completion
   *
   * @callback callback
   * @param {Error} err - Error code in case of error parsing JSON
   * @param {Object} result - Object parsed from JSON
   */
  static _parseJSON(json, callback) {
    let result;

    try {
      result = JSON.parse(json);
    } catch (e) {
      callback(new Error("Could not parse JSON from: "+json+" - "+e.message));
      return;
    }

    callback(null, result);
  }

  /**
   * _processPhantomResults
   * 
   * Processes the results output from PhantomJS
   * Filters out resources that do not have one of the following Content-Type:
   * - application/javascript
   * - text/javascript
   * - text/css
   *
   * @param {Object[]} phantomResults - Response received for each resource logged by phantom
   * @param {function} callback - Callback function on completion
   *
   * @callback callback
   * @param {Error} err - Error parsing JSON
   * @param {Object} uniquePhantomResults - Hash of URL => Object which includes size calculated by PhantomJS
   */
  static _processPhantomResults(phantomResults, contentTypes, callback) {
    let contentTypeRegExp = new RegExp(`^(${contentTypes.join('|')})`);
    let uniquePhantomResults = _.reduce(
      phantomResults,
      (memo, phantomResult) => {
        let key = phantomResult.url;
        if (contentTypeRegExp.exec(phantomResult.contentType) && !memo[key]) {
          // PhantomJS handles the event onResourceReceived multiple times for each resource
          // so the results for each resource need to be uniqued here
          memo[key] = {"phantom_size" : phantomResult.bodySize};
        }
        return memo;
      },
      {}
    );

    callback(null, uniquePhantomResults);
  }

  /**
   * _runUrlSizeRequests
   *
   * Runs requests to each individual resource in parallel
   *
   * @param {Object} uniquePhantomResults - Hash of URLs => Object
   * @param {function} callback - Callback function to call on completion
   *
   * @callback callback
   * @param {Error} err - Error requesting individual resource
   * @param {Object} uniquePhantomResults - Error requesting individual resource
   */
  static _runUrlSizeRequests(uniquePhantomResults, callback) {
    Async.parallel(
      _.map(
        uniquePhantomResults,
        (phantomSize, url) => {
          let runner = new UrlSizeRunner(url);
          return (callback) => runner.run(callback);
        }
      ),
      (err, urlSizeRunners) => {
        if (err) {
          callback(err);
          return;
        }

        _.each(
          urlSizeRunners,
          (runner) => {
            if (!uniquePhantomResults[runner.url]) {
              // Should NEVER happen - Sanity check
              uniquePhantomResults[runner.url] = {};
            }
            uniquePhantomResults[runner.url]["encoded_size"] = runner.encodedSize();
            uniquePhantomResults[runner.url]["actual_size"] = runner.actualSize();
          }
        );

        callback(null, uniquePhantomResults);
      }
    );
  }

}

module.exports = StatRunner;
