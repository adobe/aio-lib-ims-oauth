/*
Copyright 2019 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/

const ora = require('ora')
const { cli } = require('cli-ux')
const { createServer, randomId, authSiteUrl } = require('./helpers')

const AUTH_TIMEOUT_SECONDS = 120
const AUTH_URL = 'https://adobeioruntime.net/api/v1/web/53444_51636/default/appLogin/'
const AUTH_PORT = 8000
/**
 * Gets the access token for a logged in user.
 *
 * @private
 * @param {object} config an object with config details
 * @param {string} config.client_id the client id of the OAuth2 integration
 * @param {string} config.scope the scope of the OAuth2 integration
 * @param {number} config.timeout the number of seconds to timeout in checking
 */
async function login (config) {
  const id = randomId()

  const uri = authSiteUrl(AUTH_URL, { id, port: AUTH_PORT, client_id: config.client_id, scope: config.scope, redirect_uri: config.redirect_uri })
  const timeoutSeconds = config.timeout || AUTH_TIMEOUT_SECONDS

  return new Promise((resolve, reject) => {
    let spinner

    const timerId = setTimeout(() => {
      reject(new Error(`Timed out after ${timeoutSeconds} seconds.`))
      spinner.stop()
    }, timeoutSeconds * 1000)

    createServer({ port: AUTH_PORT })
      .then(state => {
        if (state.code && state.id === id) {
          spinner.info('Exchanging auth code for token')
          clearTimeout(timerId)
          resolve(state.code)
        } else {
          clearTimeout(timerId)
          reject(new Error(`error code=${state.code}`))
        }
      })

    /** @private */
    async function launch () {
      console.log('Visit this url to log in: ')
      cli.url(uri, uri)
      cli.open(uri)
      spinner = ora('Logging in').start()
    }
    launch()
  })
}

module.exports = login
