var system = require('system');
var page = require('webpage').create();

var responses = [];

page.onResourceReceived = function(response) {
  responses.push(response);
};

page.open(system.args[1], function(status) {
  if (status == "success") {
    console.log(JSON.stringify(responses));
    phantom.exit(0);
  } else {
    phantom.exit(1);
  }
});