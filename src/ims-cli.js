/*
Copyright 2020 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0
Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/

const login = require('./login')
const aioLogger = require('@adobe/aio-lib-core-logging')('@adobe/aio-lib-ims-oauth:ims-cli', { provider: 'debug' })
const { codes: errors } = require('./errors')

const CLI_BARE_OUTPUT = 'cli.bare-output'

const isEmpty = (value) => (value === undefined || value === null)

/**
 * Returns the missing keys (if any) in the configuration data.
 *
 * @private
 * @param {object} configData the configuration data for this plugin
 * @returns {Array} the missing keys, if any
 */
function configMissingKeys (configData) {
  aioLogger.debug(`configMissingKeys configData: ${JSON.stringify(configData)}`)

  if (!configData) {
    return false
  }

  const missingKeys = []
  const requiredKeys = [CLI_BARE_OUTPUT]

  requiredKeys.forEach(key => {
    if (isEmpty(configData[key])) {
      missingKeys.push(key)
    }
  })

  return missingKeys
}

const canSupportSync = (configData) => configMissingKeys(configData).length === 0

/**
 * canSupport resolves to true if the plugin supports the config.
 *
 * @param {object} configData the configuration data for this plugin
 * @returns {Promise} resolves to true if the plugin can support the config
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
 * Log in function for this plugin.
 *
 * @param {object} ims the Ims object
 * @param {object} config the configuration data for this plugin
 * @returns {Promise} resolves with the token data
 */
async function imsLogin (ims, config) {
  aioLogger.debug(`imsLogin config: ${JSON.stringify(config)}`)
  return canSupport(config)
    .then(() => {
      const options = {
        client_id: config.client_id,
        bare: config[CLI_BARE_OUTPUT],
        env: config.env,
        timeout: config.timeout,
        open: config.open,
        browser: config.browser,
        forceLogin: config.forceLogin
      }
      return login(options)
    })
}

module.exports = {
  canSupport,
  supports: canSupportSync,
  imsLogin
}
