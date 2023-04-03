/*
Copyright 2023 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/

const aioLogger = require('@adobe/aio-lib-core-logging')('@adobe/aio-lib-ims-oauth:ims-oauth_server_to_server', { provider: 'debug' })
const { codes: errors } = require('./errors')

/**
 * Checks whether the configuration data is missing any required keys.
 *
 * @private
 * @param {object} configData the confiuration data to check
 * @returns {Array} an array of missing keys, if any
 */
function configMissingKeys (configData) {
  aioLogger.debug(`configMissingKeys configData: ${JSON.stringify(configData)}`)

  const missingKeys = []
  const requiredKeys = [
    'client_id',
    'client_secrets',
    'technical_account_email',
    'technical_account_id',
    'scopes',
    'ims_org_id'
  ]

  if (!configData) {
    return requiredKeys
  }
  requiredKeys.forEach(key => {
    if (!configData[key]) {
      missingKeys.push(key)
    }
  })
  return missingKeys
}

const canSupportSync = (configData) => configMissingKeys(configData).length === 0

/**
 * Checks whether this IMS plugin can support the config data.
 *
 * @param {object} configData the confiuration data to check
 * @returns {Promise} resolves to true, if the config data is supported, rejects with an error if it's not
 */
async function canSupport (configData) {
  aioLogger.debug(`canSupport configData: ${JSON.stringify(configData)}`)

  const missingKeys = configMissingKeys(configData)
  if (missingKeys.length === 0) {
    return Promise.resolve(true)
  } else {
    return Promise.reject(new errors.MISSING_PROPERTIES({ messageValues: missingKeys.join(',') }))
  }
}

/**
 * Gets an OAuth Server to Server access token.
 *
 * @param {object} ims the Ims object
 * @param {object} config the configuration data
 * @returns {Promise<string>} a Promise with the results of the login (access token)
 */
async function imsLogin (ims, config) {
  aioLogger.debug(`imsLogin config: ${JSON.stringify(config)}`)

  return canSupport(config)
    .then(() => ims.getAccessTokenByClientCredentials(
      config.client_id, config.client_secrets[0], config.ims_org_id, config.scopes)
    )
}

module.exports = {
  canSupport,
  supports: canSupportSync,
  imsLogin
}
