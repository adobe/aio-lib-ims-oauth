/*
Copyright 2018 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/

const ProxyServer = require('./proxy.js');
const Browser = require('./browser.js')
const url = require('url');
const querystring = require('querystring');
const debug = require('debug')('@adobe/aio-cli-plugin-ims-oauth/login');

// The ims-login hook for OAuth2 (SUSI) is taking care of calling IMS
// the function takes the

function canSupportSync(configData) {
  if (!configData) {
    return false;
  }

  const missing_keys = [];
  const required_keys = ['callback_url', 'client_id', 'client_secret', 'scope'];

  required_keys.forEach(key => {
    if (!configData[key]) {
      missing_keys.push(key)
    }
  })

  return missing_keys.length == 0;
}

async function canSupport(configData) {
  if (canSupportSync(configData)) {
    return Promise.resolve(true);
  } else {
    // TODO: Indicate that this is not really an error but just a possibility
    return Promise.reject(`OAuth2 not supported due to some missing properties: ${missing_keys}`);
  }
}

// The result of the browser and proxy interaction, which can take values
// as follows:
//   > access token result: If the user authenticated successfully and the
//           getAccessToken function received the access token
//   > Error object as follows:
//         (1) if the user kills the browser before completing
//         (2) if the access token cannot be generated after the user provided
//             the credentials
let webResult = undefined;

async function getAccessToken(requestUrl) {
  debug("getAccessToken(%s)", requestUrl);
  requestUrl = url.parse(requestUrl);
  query = querystring.parse(requestUrl.query);
  if (query.code) {
    debug("  > code: %s", query.code);
    try {
      webResult = query.code;
      debug("  > Received: %o", webResult);
    } catch (err) {
      debug("  > Error: %O", err);
      webResult = err;
    }
    cleanUp();
  } else {
    debug("  > Received request without code; just ignore and continue.");
  }
}

/**
 * Sets an error to the webResult field if the user terminates the browser early.
 * To prevent overwriting any possibly positive result from getting the access token
 * this function will not overwrite any value in the webResult field.
 */
function userTerminatedBrowser() {
  if (!webResult) {
    webResult = new Error("User terminated the browser without authentication");
    debug(webResult);
  }
  cleanUp();
}

let proxy = undefined;
let browser = undefined;

// terminate the proxy and the browser
async function cleanUp() {
  debug("cleanUp()");
  if (browser) {
    browser.terminate();
    browser = null;
  }

  if (proxy) {
    proxy.terminate();
    browser = null;
  }
}

async function setupWeb(ims, config) {
  debug("setupWeb(%o)", config);
  proxy = new ProxyServer(config.callback_url, getAccessToken);
  const appUrl = ims.getSusiUrl(config.client_id, config.scope, config.callback_url, config.state);
  proxy.listen().
    then(proxyUrl => {
      debug("  > proxy : %s", proxyUrl);
      debug("  > appUrl: %s", appUrl);
      browser = new Browser(appUrl, proxyUrl).launch(false, userTerminatedBrowser);
    });
}


async function checkWebResult() {
  if (!webResult) {
    debug("checkWebResult: No result yet, continue polling");
    return new Promise(resolve => setTimeout(resolve.bind(null), 100) ).then(checkWebResult);
  } else if (webResult instanceof Error) {
    debug("checkWebResult: Rejecting on error: %o", webResult);
    return Promise.reject(webResult);
  } else {
    debug("checkWebResult: Resolving with code: %s", webResult);
    return Promise.resolve(webResult);
  }
}

async function imsLogin(ims, config) {
  return canSupport(config)
    .then(() => setupWeb(ims, config))
    .then(checkWebResult)
    .then(authorizationCode => ims.getAccessToken(authorizationCode, config.client_id, config.client_secret, config.scope))
}

module.exports = {
  supports: canSupportSync,
  imsLogin
}
