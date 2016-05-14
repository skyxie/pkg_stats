
const Path = require('path');
var cmd = require('commander');

const StatRunner = require(Path.join(__dirname, 'stat-runner'));

function collect(val, memo) {
  memo.push(val);
  return memo;
}

cmd.version('0.0.1')
  .usage("-u [url]")
  .option('-u, --url [url]', 'Collect stats for packages on given url')
  .option('-e, --enc [enc]', 'Collect stats requested with Encoding', collect, [])
  .parse(process.argv);

if (cmd.url) {
  runner = new StatRunner(cmd.url);
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
