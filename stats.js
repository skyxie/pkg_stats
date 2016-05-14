var system = require('system');
var page = require('webpage').create();

var responses = [];

page.onResourceReceived = function(response) {
  responses.push(response);
};

page.open(system.args[1], function(status) {
  console.log(JSON.stringify(response, null, 2));
  phantom.exit();
});