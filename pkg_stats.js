
var path = require('path');
var cmd = require('commander');
var childProcess = require('child_process');
var phantomjs = require('phantomjs-prebuilt');

function runStats(url) {
  var binPath = phantomjs.path;
  var childArgs = [path.join(__dirname, 'stats.js'), url];
  childProcess.execFile(binPath, childArgs, function(err, stdout, stderr) {
    console.log(stdout);
  });
}

cmd.version('0.0.1')
  .usage("-u <url>")
  .option('-u <url>', 'Collect package stats on given url')
  .parse(process.argv);

if (cmd.url) {
  runStats(cmd.url);
} else {
  cmd.help();
}
