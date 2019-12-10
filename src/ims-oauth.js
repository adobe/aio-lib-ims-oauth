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

const Electron = require('./electron')
const debug = require('debug')('@adobe/aio-lib-core-ims-oauth/ims-oauth')

function configMissingKeys (configData) {
  if (!configData) {
    return false
  }

  const missingKeys = []
  const requiredKeys = ['callback_url', 'client_id', 'client_secret', 'scope']

  requiredKeys.forEach(key => {
    if (!configData[key]) {
      missingKeys.push(key)
    }
  })

  return missingKeys
}

const canSupportSync = (configData) => configMissingKeys(configData).length === 0

async function canSupport (configData) {
  const missingKeys = configMissingKeys(configData)
  if (missingKeys.length === 0) {
    return Promise.resolve(true)
  } else {
    return Promise.reject(new Error(`OAuth2 not supported due to some missing properties: ${missingKeys}`))
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
let gWebResult

/**
 * Called when the Electron app driving the SUSI flow terminates.
 * The result parameter is either the authorization code to get the
 * access token or an Error object providing a message indicating
 * the reason for failure.
 * This result is assigned to the webResult variable.
 *
 * @param result {string | Error} The result of running the Electron app,
 *          which may be a string in the success case or an Error if the
 *          authorization code is not provided.
 */
function electronCallback (result, state) {
  debug('electronCallback(%o, %s)', result, state)
  gWebResult = result || new Error('No result received from web app')
  debug('  > %o', gWebResult)
}

async function setupWeb (ims, config, state, force) {
  debug('setupWeb(config=%o, state=%s, force=%s)', config, force)
  const appUrl = ims.getSusiUrl(config.client_id, config.scope, config.callback_url, state)
  debug('  > appUrl=%s', appUrl)
  return new Electron(appUrl, config.callback_url, force).launch(electronCallback)
}

async function checkWebResult () {
  if (!gWebResult) {
    debug('checkWebResult: No result yet, continue polling')
    return new Promise(resolve => setTimeout(resolve.bind(null), 100)).then(checkWebResult)
  } else if (gWebResult instanceof Error) {
    debug('checkWebResult: Rejecting on error: %o', gWebResult)
    return Promise.reject(gWebResult)
  } else {
    debug('checkWebResult: Resolving with code: %s', gWebResult)
    return Promise.resolve(gWebResult)
  }
}

async function imsLogin (ims, config, force) {
  const state = 'oauth-imslogin-' + Date.now()
  return canSupport(config)
    .then(() => setupWeb(ims, config, state, force))
    .then(checkWebResult)
    .then(authorizationCode => ims.getAccessToken(authorizationCode, config.client_id, config.client_secret, config.scope))
}

module.exports = {
  supports: canSupportSync,
  imsLogin
}
