aio-cna-core-ims-oauth
==========================

OAuth2 (SUSI) token creation plugin for [`aio-cna-core-ims`](https://github.com/adobe/aio-cna-core-ims).

[![Version](https://img.shields.io/npm/v/aio-cna-core-ims-oauth.svg)](https://npmjs.org/package/aio-cna-core-ims-oauth)
[![Downloads/week](https://img.shields.io/npm/dw/aio-cna-core-ims-oauth.svg)](https://npmjs.org/package/aio-cna-core-ims-oauth)
[![License](https://img.shields.io/npm/l/aio-cna-core-ims-oauth.svg)](https://github.com/adobe/aio-cna-core-ims-oauth/blob/master/package.json)

This plugin is intended to be used in conjunction with the [`aio-cna-core-ims`](https://github.com/adobe/aio-cna-core-ims) extending that to support browser based 3-legged OAuth2 authentication with IMS commonly known as _SUSI flow_.
For more information about the general setup of the Adobe I/O CLI IMS Plugin, please refer to [`aio-cna-core-ims`](https://github.com/adobe/aio-cna-core-ims).

The 3-legged OAuth2 requires interaction with a browser as the initial authentication step to receive the authorization code may be involving multiple browser based steps.
For example an IMS Enterprise integration may involve further redirects to a 3rd party for actual authentication.

To cope with this complexity, the OAuth2 plugin actually launches a simple [Electron](https://electronjs.org) app to start with the SUSI flow and to capture the authorization code as IMS redirects back to the `callback_url` with that authorization code.

The controller of the Electron app is the [electron.js](src/electron.js) script which spawns the Electron app and receives the outcome in a callback function.
The Electron app's main script is [main.js](lib/main.js) referenced by the simple [package.js](lib/package.json) file.
The script is the main driver for the SUSI flow and captures any redirects received.
Once the redirect to the `callback_url` is received, the authorization code is peeled out of the redirect URL and written to `stdout`.
At this point the Electron app terminates with an exit code of zero (0).
If any error occurrs during the login procedure, such as the user prematurely terminating the Electron app by closing the window, an error message is written to `stderr` and the Electron app terminates with a non-zero exit code.

The launcher will inspect the exit code of the Electron app and set and call the `electronCallback` function (see [ims-oauth.js](src/ims-oauth.js)) appropriately:

* In case of success, the result from `stdout` is provided to the callback function
* In the case of failure, an Error object with the message from `stderr` is provided to the callback function.

The call back function then sets the `webResult` variable with this result for it to be picked up by the `checkWebResult` function for further processing as a `Promise` and returning to the IMS plugin.
