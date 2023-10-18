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

const http = require('node:http')
const url = require('node:url')
const crypto = require('node:crypto')
const aioLogger = require('@adobe/aio-lib-core-logging')('@adobe/aio-lib-ims-oauth:helpers', { provider: 'debug' })
const querystring = require('node:querystring')
const { getCliEnv } = require('@adobe/aio-lib-env')
const { codes: errors } = require('./errors')
const process = require('node:process')

const PROTOCOL_VERSION = 2

const IMS_CLI_OAUTH_URL = {
  prod: 'https://aio-login.adobeioruntime.net/api/v1/web/default/applogin',
  stage: 'https://aio-login-stage.adobeioruntime.net/api/v1/web/default/applogin'
}

const IMS_CLI_OAUTH_LOGOUT_URL = {
  // TODO: separate out client_id
  prod: 'https://ims-na1.adobelogin.com/ims/logout/v1?client_id=aio-cli-console-auth&redirect_uri=',
  stage: 'https://ims-na1-stg1.adobelogin.com/ims/logout/v1?client_id=aio-cli-console-auth-stage&redirect_uri='
}

/**
 * Create a local server.
 *
 * @returns {Promise} resolves to the http.server created, after it has started
 */
async function createServer () {
  return new Promise(resolve => {
    const server = http.createServer()

    server.listen(0, '127.0.0.1')
    server.on('listening', () => {
      resolve(server)
    })
  })
}

/**
 * Get the aio-cli's IMS OAuth URL
 *
 * @param {string} [env=prod] the IMS environment
 * @returns {string} the url
 */
function getImsCliOAuthUrl (env = getCliEnv()) {
  return IMS_CLI_OAUTH_URL[env]
}

/**
 * Construct the auth site url with these query params.
 *
 * @param {object} queryParams the query params to add to the url
 * @param {string} [env=prod] the IMS environment
 * @param {boolean} [forceLogin=false] whether to force a logout before login
 * @returns {string} the constructed url
 */
function authSiteUrl (queryParams, env = getCliEnv(), forceLogin = false) {
  const uri = new url.URL(getImsCliOAuthUrl(env))
  aioLogger.debug(`authSiteUrl queryParams: ${JSON.stringify(queryParams)} env: ${env} uri: ${uri}`)

  Object.keys(queryParams).forEach(key => {
    const value = queryParams[key]
    if (value !== undefined && value !== null) {
      uri.searchParams.set(key, queryParams[key])
    }
  })
  if (forceLogin) {
    const forceUri = new url.URL(IMS_CLI_OAUTH_LOGOUT_URL[env])
    forceUri.searchParams.set('redirect_uri', encodeURI(uri.href))
    return forceUri.href
  } else {
    return uri.href
  }
}

/**
 * Generates a random 4 character hex id.
 *
 * @returns {string} a random string
 */
const randomId = () => crypto.randomBytes(4).toString('hex')

/**
 * Safe convert from string to json.
 *
 * @private
 * @param {string} value the value to parse to json
 * @returns {object} the json object converted from the input
 **/
function stringToJson (value) {
  try {
    return JSON.parse(value)
  } catch (e) {
    return {}
  }
}

/**
 * Sets the CORS headers to the response.
 *
 * @param {object} response the Response object
 * @param {string} [env=prod] the IMS environment
 * @returns {object} return the Response object
 */
function cors (response, env = getCliEnv()) {
  const origin = new url.URL(IMS_CLI_OAUTH_URL[env]).origin
  aioLogger.debug(`cors env: ${env} origin: ${origin}`)

  response.setHeader('Content-Type', 'text/plain')
  response.setHeader('Access-Control-Allow-Origin', origin)
  response.setHeader('Access-Control-Request-Method', '*')
  response.setHeader('Access-Control-Allow-Methods', 'OPTIONS, POST')
  response.setHeader('Access-Control-Allow-Headers', '*')

  return response
}

/**
 * Transforms the code based on the codeTtype.
 *
 * @param {string} code the code to transform
 * @param {string} codeType one of 'access_token', 'auth_code'
 * @returns {string|object} the transformed code (if applicable)
 */
function codeTransform (code, codeType) {
  aioLogger.debug(`codeTransform code: ${code} codeType: ${codeType}`)

  if (codeType === 'access_token') {
    return JSON.parse(code)
  }

  return code
}

/**
 * OPTIONS http method handler
 *
 * @param {object} _request the Request object
 * @param {object} response the Response object
 * @param {Function} done callback function
 * @param {string} [env=prod] the IMS environment
 */
function handleOPTIONS (_request, response, done, env = getCliEnv()) {
  aioLogger.debug(`handleOPTIONS env: ${env}`)
  cors(response, env).end()
  done && done()
}

/**
 * GET http method handler.
 *
 * @param {object} request the Request object
 * @param {object} response the Response object
 * @param {string} id the secret id to compare to from the request 'state' data
 * @param {Function} done callback function
 * @param {string} [env=prod] the IMS environment
 * @returns {Promise} resolves to the auth code or access_Token
 */
async function handleGET (request, response, id, done, env = getCliEnv()) {
  aioLogger.debug(`handleGET id: ${id} done: ${done} env: ${env}`)

  return new Promise((resolve, reject) => {
    cors(response, env)
    const requestUrl = request.url.replace(/^.*\?/, '')
    const queryData = querystring.parse(requestUrl)
    const state = stringToJson(queryData.state)
    aioLogger.debug(`state: ${JSON.stringify(state)}`)
    aioLogger.debug(`queryData: ${JSON.stringify(queryData)}`)

    if (queryData.code && state.id === id) {
      resolve(codeTransform(queryData.code, queryData.code_type))
      const signedInUrl = `${IMS_CLI_OAUTH_URL[env]}/signed-in`
      response.setHeader('Cache-Control', 'private, no-cache')
      response.writeHead(302, { Location: signedInUrl })
      response.end()
    } else {
      response.statusCode = 400
      const message = 'An error occurred in the cli.'
      const errorUrl = `${IMS_CLI_OAUTH_URL[env]}/error?message=${message}`
      response.setHeader('Cache-Control', 'private, no-cache')
      response.writeHead(302, { Location: errorUrl })
      response.end()
      reject(new errors.HTTP_ERROR({ messageValues: queryData.code }))
    }
    done()
  })
}

/**
 * Create a JSON response.
 *
 * @param {object} params parameters
 * @param {string} [params.redirect] the redirect url
 * @param {string} [params.message] the message to display
 * @param {boolean} [params.error=false] whether the message is an error
 * @returns {object} the created JSON
 */
function createJsonResponse ({ redirect, message, error = false }) {
  aioLogger.debug(`createJsonResponse redirect: ${redirect} message: ${message} error: ${error}`)

  return {
    protocol_version: PROTOCOL_VERSION,
    redirect,
    error,
    message
  }
}

/**
 * POST http method handler.
 *
 * @param {object} request the Request object
 * @param {object} response the Response object
 * @param {string} id the secret id to compare to from the request 'state' data
 * @param {Function} done callback function
 * @param {string} [env=prod] the IMS environment
 * @returns {Promise} resolves to the auth code or access_Token
 */
async function handlePOST (request, response, id, done, env = getCliEnv()) {
  aioLogger.debug(`handlePOST id: ${id} done: ${done} env: ${env}`)

  return new Promise((resolve, reject) => {
    cors(response, env)
    let body = ''

    request.on('data', data => {
      body += data.toString()
    })

    request.on('end', async () => {
      const queryData = querystring.parse(body)
      const state = stringToJson(queryData.state)
      aioLogger.debug(`state: ${JSON.stringify(state)}`)
      aioLogger.debug(`queryData: ${JSON.stringify(queryData)}`)

      if (queryData.code && state.id === id) {
        resolve(codeTransform(queryData.code, queryData.code_type))
        response.statusCode = 200
        const redirect = `${IMS_CLI_OAUTH_URL[env]}/signed-in`
        // send string for backwards compat reasons
        response.end(JSON.stringify(createJsonResponse({ redirect })))
      } else {
        response.statusCode = 400
        const message = 'An error occurred in the cli.'
        const redirect = `${IMS_CLI_OAUTH_URL[env]}/error?message=${message}`
        // send string for backwards compat reasons
        response.end(JSON.stringify(createJsonResponse({ redirect, message, error: true })))
        reject(new errors.HTTP_ERROR({ messageValues: queryData.code }))
      }
      done()
    })
  })
}

/**
 * Unsupported HTTP method handler.
 *
 * @param {object} _request the Request object
 * @param {object} response the Response object
 * @param {Function} done callback function
 * @param {string} [env=prod] the IMS environment
 */
function handleUnsupportedHttpMethod (_request, response, done, env = getCliEnv()) {
  aioLogger.debug(`handleUnsupportedHttpMethod env: ${env}`)

  response.statusCode = 405
  cors(response, env).end('Supported HTTP methods are OPTIONS, GET, POST')
  done()
}

/**
 * On Windows, node should read all system environment variables case insensitively:
 *   https://nodejs.org/api/process.html#processenv
 *
 * However, this line in the `open` module is returning `undefined` for `process.env.SYSTEMROOT`:
 *   https://github.com/sindresorhus/open/blob/cbc008bab21f657475b54e33a823b2941737da6f/index.js#L147
 *
 * `process.env.SystemRoot` seems to be always available however, so based on the docs for `process`,
 *  this could be a bug in `node.js`:
 *    https://github.com/sanity-io/sanity/pull/4221
 *
 * We work around this for `open` by setting `SYSTEMROOT` to be equal to `SystemRoot`, if the env var is available.
 */
function patchWindowsEnv () {
  if (process.platform !== 'win32') {
    return
  }

  if (process.env.SystemRoot) {
    process.env.SYSTEMROOT = process.env.SystemRoot
  }
}

module.exports = {
  patchWindowsEnv,
  handleGET,
  handlePOST,
  handleOPTIONS,
  handleUnsupportedHttpMethod,
  codeTransform,
  cors,
  stringToJson,
  randomId,
  authSiteUrl,
  createServer,
  IMS_CLI_OAUTH_URL,
  IMS_CLI_OAUTH_LOGOUT_URL,
  getImsCliOAuthUrl
}
