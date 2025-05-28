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
const open = require('./open')
const ciInfo = require('ci-info')
const { randomId, authSiteUrl, getImsCliOAuthUrl, createServer, handleOPTIONS, handleGET, handlePOST, handleUnsupportedHttpMethod } = require('./helpers')
const { codes: errors } = require('./errors')

const AUTH_TIMEOUT_SECONDS = 120
const LOGIN_SUCCESS = '/login-success'

/**
 * Gets the access token / auth code for a signed in user.
 *
 * @param {object} options the optional configuration
 * @param {boolean} [options.bare=false] If true, suppresses spinners and verbose messages, for script-friendly or headless output. If false (default), provides interactive feedback.
 * @param {string} [options.env] The IMS environment to use.
 * @param {number} [options.timeout] The timeout in seconds for the login process.
 * @param {string} [options.client_id] The client id of the OAuth2 integration.
 * @param {string} [options.scope] The scope of the OAuth2 integration.
 * @param {boolean} [options.forceLogin] If true, forces the user to log in even if they have an active session.
 * @param {boolean} [options.autoOpen=true] If true, attempts to automatically open the login URL in the default browser.
 * @param {string} [options.browser] Specify the browser application to use for opening the login URL.
 * @returns {Promise<object|string>} Resolves to an access token object or an auth code string.
 */
async function login (options) {
  aioLogger.debug(`login options: ${JSON.stringify(options)}`)

  const {
    bare = false,
    env,
    timeout = AUTH_TIMEOUT_SECONDS,
    client_id, // eslint-disable-line camelcase
    scope,
    forceLogin,
    autoOpen = true,
    browser: app
  } = options

  const redirect_uri = `${getImsCliOAuthUrl(env)}${LOGIN_SUCCESS}` // eslint-disable-line camelcase
  const id = randomId()
  const server = await createServer()
  const serverPort = server.address().port
  // eslint-disable-next-line camelcase
  const uri = authSiteUrl({ id, port: serverPort, client_id, scope, redirect_uri }, env, forceLogin)

  aioLogger.debug(`Local server created on port ${serverPort}.`)

  return new Promise((resolve, reject) => {
    let spinner

    if (ciInfo.isCI && !bare) {
      // CI path and !bare (so show spinner messages)
      spinner = ora()
      spinner.fail('CI Environment: Interactive login not supported. Use technical account via env vars for authentication. For guidance, see https://github.com/adobe/aio-apps-action')
      return reject(new errors.IMSOAUTHCLI_LOGIN_CI_ERROR())
    } else if (ciInfo.isCI) {
      // CI Environment Path, and bare (so no spinner messages)
      return reject(new errors.IMSOAUTHCLI_LOGIN_CI_ERROR())
    } else {
      // Non-CI Environment Path
      if (!bare) {
        // Non-CI, !bare: Interactive mode with spinners
        spinner = ora()
        spinner.stopAndPersist({ text: 'Visit this url to log in:\n' + uri })
        spinner.start('Waiting for browser login')
      } else {
        // Non-CI, bare: No spinners. Log URI for manual use
        console.error(`Login URI (for manual use if browser does not open automatically): ${uri}`)
      }

      if (autoOpen) {
        open(uri, { app })
      }

      const timerId = setTimeout(() => {
        if (!bare && spinner) { // Ensure spinner exists
          spinner.fail()
        }
        reject(new errors.TIMEOUT({ messageValues: timeout }))
      }, timeout * 1000)

      const cleanup = () => {
        clearTimeout(timerId)
        if (!bare && spinner) { // Ensure spinner exists
          spinner.succeed('Login successful')
        }
        server.close()
      }

      server.on('request', async (request, response) => {
        aioLogger.debug(`http method: ${request.method}`)
        try {
          switch (request.method) {
            case 'OPTIONS':
              return handleOPTIONS(request, response, null, env)
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
              return handleUnsupportedHttpMethod(request, response, cleanup, env)
          }
        } catch (error) {
          if (!bare && spinner) { // Ensure spinner exists
            spinner.fail()
          }
          cleanup()
          reject(error)
        }
      })
    }
  })
}

module.exports = login
