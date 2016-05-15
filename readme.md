pkg_stats
===============

# Description

This script measures the actual and encoded size of all resources loaded on a web-page. This measurement is performed through the following steps:

1. Dump all resources loaded via PhantomJS. PhantomJS starts a headless web browser and emits events when resources are loaded. It includes a measurement of the size of the resoruce, but measurement is frequently wrong. All resources are dumped to STDOUT in JSON.
2. Collect results from PhantomJS including filtering resources by desired Content-Type.
3. Re-request resources and measure bytes from stream to calculate size from response.
4. When the response includes a Content-Encoding header, pipe the response stream through gunzip into another stream to calculate actual uncompressed size of resource.
5. Report all size mesaurements to STDOUT in JSON.

# Setup

This script is written in node.js so it depends on node and npm.

* [nodenv](https://github.com/nodenv/nodenv) - Optional, but highly recommended tool to make it easier to install and manage node versions.
* node version > 4.4.4 - Latest stable version of Node
* npm

This command will install all libraries needed.

    npm install

# Run
    
    Usage: pkg_stats -u [url]

    Options:

      -h, --help                         output usage information
      -V, --version                      output the version number
      -u, --url [url]                    Collect stats for packages on given url
      -t, --timeout [timeout]            Load resources on web-page for ms (Default: 1000)
      -c, --contentTypes [contentTypes]  Resources matching Content-Types (Default: application/javascript,text/css)

Basic use case - measure size of application/javascript and text/css resources on http://somewhere.com

    bin/pkg_stats.js -u http://somewhere.com

Measure size of application/javascript and text/css resources loaded on http://somewhere.com for up to 2 min

    bin/pkg_stats.js -u http://somewhere.com -t 120000

Measure size of application/javascript, text/css, and image/jpeg resources on http://somewhere.com

    bin/pkg_stats.js -u https://somewhere.com -c application/javascript,text/css,image/jpeg

# Output

Output should be a JSON hash:

    {
      "https://assets.somewhere.com/assets/home.jpg": {
        "phantom_size": 33585,
        "encoded_size": 54176,
        "actual_size": 54176
      },
      "https://ajax.googleapis.com/ajax/libs/jquery/2.2.2/jquery.min.js": {
        "phantom_size": 7847,
        "encoded_size": 29892,
        "actual_size": 85656
      }
    }

The keys of the hash is the URL for the resource. The attributes of the hash are:

* **phantom_size**: Size measured by PhantomJS
* **encoded_size**: Encoded bytes downloaded to the browser
* **actual_size**: Uncompressed size of the resource

