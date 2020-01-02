@adobe/aio-lib-core-ims-oauth
==========================

OAuth2 (SUSI) token creation plugin for [`aio-lib-core-ims`](https://github.com/adobe/aio-lib-core-ims).

[![Version](https://img.shields.io/npm/v/@adobe/aio-lib-core-ims-oauth.svg)](https://npmjs.org/package/@adobe/aio-lib-core-ims-oauth)
[![Downloads/week](https://img.shields.io/npm/dw/@adobe/aio-lib-core-ims-oauth.svg)](https://npmjs.org/package/@adobe/aio-lib-core-ims-oauth)
[![Build Status](https://travis-ci.com/adobe/aio-lib-core-ims-oauth.svg?branch=master)](https://travis-ci.com/adobe/aio-lib-core-ims-oauth)
[![Codecov Coverage](https://img.shields.io/codecov/c/github/adobe/aio-lib-core-ims-oauth/master.svg?style=flat-square)](https://codecov.io/gh/adobe/aio-lib-core-ims-oauth/)
[![License](https://img.shields.io/npm/l/@adobe/aio-lib-core-ims-oauth.svg)](https://github.com/adobe/aio-lib-core-ims-oauth/blob/master/package.json)
[![Greenkeeper badge](https://badges.greenkeeper.io/adobe/aio-lib-core-ims-oauth.svg)](https://greenkeeper.io/)

This plugin is intended to be used in conjunction with the [`aio-lib-core-ims`](https://github.com/adobe/aio-lib-core-ims) extending that to support browser based 3-legged OAuth2 authentication with IMS commonly known as _SUSI flow_.

For more information about the general setup of the Adobe I/O CLI IMS Plugin, please refer to [`aio-lib-core-ims`](https://github.com/adobe/aio-lib-core-ims).

The 3-legged OAuth2 requires interaction with a browser as the initial authentication step to receive the authorization code may be involving multiple browser based steps.
For example an IMS Enterprise integration may involve further redirects to a 3rd party for actual authentication.

Workflow:
1. A 4-byte random pass-code is generated
2. A localhost web server is created, listening at a port number
3. An Adobe I/O Runtime web action is opened in the browser, passing in this pass-code, the localhost web server port number, the client id, and the IMS scope as query parameters
3. The Adobe I/O Runtime web action will redirect to the IMS authorization endpoint, with the scope, client id and a csrf token as the `state` property (derived from the id, client id, scope and localhost port) passed in as query parameters
4. When the user is authenticated or an error occurs, the IMS endpoint will redirect to the Adobe I/O Runtime web action's `login-success` path
5. If the authentication is successful, the Adobe I/O Runtime web action will redirect to the localhost web server at the specified port (derived from the `state` property), and forward the `state` and `code` properties to the localhost web server call as query parameters
6. The localhost web server will pass on the authorization code to the library, and the library will call an IMS endpoint to exchange the authorization code for an access token and refresh token
7. If the authentication is not successful, the Adobe I/O Runtime web action will report an error message in the web browser

The Adobe I/O Runtime function used (currently in testing) is coming soon.

# Config 

Add the `oauth2` context into your `.aio` file in your current working directory (project folder), under `$ims`:
```javascript
{
  $ims: {
    oauth2: {
        auth_url: "YOUR_AUTH_URL_IN_IO_RUNTIME",
        client_id: "YOUR_CLIENT_ID",
        client_secret: "YOUR_CLIENT_SECRET",
        scope: "YOUR_IMS_SCOPE"
        port: 8000
    }
  }
}
```
The context can be named anything (here `oauth2` is chosen for the context name).


# Contributing
Contributions are welcomed! Read the [Contributing Guide](CONTRIBUTING.md) for more information.


# Licensing

This project is licensed under the Apache V2 License. See [LICENSE](LICENSE) for more information.
