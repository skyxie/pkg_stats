#!/usr/bin/env node

"use strict";

const Path = require('path');
let cmd = require('commander');

const StatRunner = require(Path.join(__dirname, 'stat-runner'));

function collect(val, memo) {
  memo.push(val);
  return memo;
}

cmd.version('0.0.1')
  .usage("-u [url]")
  .option('-u, --url [url]',
          'Collect stats for packages on given url')
  .option('-t, --timeout [timeout]',
          'Load resources on web-page for given period of milliseconds (Default: 1000)', parseInt)
  .option('-c, --contentTypes [contentTypes]',
          'Analyze resources matching Content-Types (Default: application/javascript,text/css)')
  .parse(process.argv);

if (cmd.url) {
  let contentTypes = ['application/javascript','text/css'];
  if (cmd.contentTypes) {
    contentTypes = cmd.contentTypes.split(',');
  }

  let timeout = 1000;
  if (cmd.timeout) {
    timeout = cmd.timeout;
  }

  let runner = new StatRunner(cmd.url, timeout, contentTypes);
  runner.run((err, result) => {
    if (err) {
      console.log("Failed to collect package stats for "+cmd.url+" - "+err.message);
    } else {
      console.log(JSON.stringify(result, null, 2));
    }
  });
} else {
  cmd.help();
}
