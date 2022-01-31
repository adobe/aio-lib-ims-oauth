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

const aioLogger = require('@adobe/aio-lib-core-logging')('@adobe/aio-lib-ims-oauth:login', { provider: 'debug' })
const ora = require('ora')
const { cli } = require('cli-ux')
const { randomId, authSiteUrl, getImsCliOAuthUrl, createServer, handleOPTIONS, handleGET, handlePOST, handleUnsupportedHttpMethod } = require('./helpers')
const { codes: errors } = require('./errors')

const AUTH_TIMEOUT_SECONDS = 120
const LOGIN_SUCCESS = '/login-success'

/**
 * Gets the access token / auth code for a signed in user.
 *
 * @param {object} options the optional configuration, { bare, env, timeout, client_id, scope, autoOpen }
 * @param {number} [options.bare=false] set to true to not have any progress text
 * @param {number} [options.timeout] the timeout in seconds
 * @param {string} [options.client_id] the client id of the OAuth2 integration
 * @param {string} [options.scope] the scope of the OAuth2 integration
 * @param {string} [options.redirect_uri] the redirect uri of the OAuth2 integration
 * @returns {Promise} resolves to an access token/auth code
 */
async function login (options) {
  aioLogger.debug(`login options: ${JSON.stringify(options)}`)

  // eslint-disable-next-line camelcase
  const { bare = false, env, timeout = AUTH_TIMEOUT_SECONDS, client_id, scope, autoOpen = true } = options
  const redirect_uri = `${getImsCliOAuthUrl(env)}${LOGIN_SUCCESS}` // eslint-disable-line camelcase
  const id = randomId()
  const server = await createServer()
  const serverPort = server.address().port
  const uri = authSiteUrl({ id, port: serverPort, client_id, scope, redirect_uri }, env)

  aioLogger.debug(`Local server created on port ${serverPort}.`)

  return new Promise((resolve, reject) => {
    let spinner

    if (!bare) {
      console.log('Visit this url to log in: ')
      cli.url(uri, uri)
      spinner = ora('Logging in').start()
    }
    if (autoOpen) {
      cli.open(uri)
    }

    const timerId = setTimeout(() => {
      reject(new errors.TIMEOUT({ messageValues: timeout }))
      if (!bare) {
        spinner.stop()
      }
    }, timeout * 1000)

    server.on('request', async (request, response) => {
      aioLogger.debug(`http method: ${request.method}`)

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
            return handleOPTIONS(request, response, env)
          case 'POST': {
            const result = await handlePOST(request, response, id, cleanup, env)
            resolve(result)
          }
            break
          case 'GET': {
            const result = await handleGET(request, response, id, cleanup, env)
            resolve(result)
          }
            break
          default:
            return handleUnsupportedHttpMethod(request, response, env)
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
