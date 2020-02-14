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

const debug = require('debug')('aio-lib-core-ims-oauth/login')
const ora = require('ora')
const { cli } = require('cli-ux')
const { randomId, authSiteUrl, createServer, handleOPTIONS, handlePOST, handleUnsupportedHttpMethod } = require('./helpers')

const AUTH_TIMEOUT_SECONDS = 120

/**
 * Gets the access token / auth code for a signed in user.
 *
 * @param {object} options the optional configuration
 * @param {number} [options.bare=false] set to true to not have any progress text
 * @param {number} [options.timeout] the timeout in seconds
 * @param {string} [options.client_id] the client id of the OAuth2 integration
 * @param {string} [options.scope] the scope of the OAuth2 integration
 * @param {string} [options.redirect_uri] the redirect uri of the OAuth2 integration
 */
async function login (options) {
  // eslint-disable-next-line camelcase
  const { bare = false, timeout = AUTH_TIMEOUT_SECONDS, client_id, scope, redirect_uri } = options
  const id = randomId()
  const server = await createServer()
  const serverPort = server.address().port
  const uri = authSiteUrl({ id, port: serverPort, client_id, scope, redirect_uri })

  debug(`Local server created on port ${serverPort}.`)

  return new Promise((resolve, reject) => {
    let spinner

    if (!bare) {
      console.log('Visit this url to log in: ')
      cli.url(uri, uri)
      spinner = ora('Logging in').start()
    }
    cli.open(uri)

    const timerId = setTimeout(() => {
      reject(new Error(`Timed out after ${timeout} seconds.`))
      if (!bare) {
        spinner.stop()
      }
    }, timeout * 1000)

    server.on('request', async (request, response) => {
      debug(`http method: ${request.method}`)

      const cleanup = () => {
        clearTimeout(timerId)
        if (!bare) {
          spinner.stop()
        }
        server.close()
      }

      try {
        switch (request.method) {
          case 'OPTIONS':
            return handleOPTIONS(request, response)
          case 'POST': {
            const result = await handlePOST(request, response, id, cleanup)
            resolve(result)
          }
            break
          default:
            return handleUnsupportedHttpMethod(request, response)
        }
      } catch (error) {
        if (!bare) {
          spinner.fail()
        }
        reject(error)
      }
    })
  })
}

module.exports = login
