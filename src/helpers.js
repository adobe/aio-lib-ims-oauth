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

const http = require('http')
const url = require('url')
const crypto = require('crypto')
const debug = require('debug')('aio-lib-ims-oauth/helpers')
const querystring = require('querystring')

const DEFAULT_ENV = 'prod'

const IMS_CLI_OAUTH_URL = {
  prod: 'https://aio-login.adobeioruntime.net/api/v1/web/default/applogin',
  stage: 'https://aio-login.adobeioruntime.net/api/v1/web/default/applogin-stage'
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
 * Construct the auth site url with these query params.
 *
 * @param {object} queryParams the query params to add to the url
 * @param {string} [env=prod] the IMS environment
 * @returns {string} the constructed url
 */
function authSiteUrl (queryParams, env = DEFAULT_ENV) {
  const uri = new url.URL(IMS_CLI_OAUTH_URL[env])
  Object.keys(queryParams).forEach(key => {
    const value = queryParams[key]
    if (value !== undefined && value !== null) {
      uri.searchParams.set(key, queryParams[key])
    }
  })
  return uri.href
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
function cors (response, env = DEFAULT_ENV) {
  response.setHeader('Content-Type', 'text/plain')
  response.setHeader('Access-Control-Allow-Origin', new url.URL(IMS_CLI_OAUTH_URL[env]).origin)
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
  if (codeType === 'access_token') {
    return JSON.parse(code)
  }

  return code
}

/**
 * OPTIONS http method handler
 *
 * @param {object} request the Request object
 * @param {object} response the Response object
 * @param {string} [env=prod] the IMS environment
 */
function handleOPTIONS (request, response, env = DEFAULT_ENV) {
  cors(response, env).end()
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
async function handlePOST (request, response, id, done, env = DEFAULT_ENV) {
  return new Promise((resolve, reject) => {
    cors(response, env)
    let body = ''

    request.on('data', data => {
      body += data.toString()
    })

    request.on('end', async () => {
      const queryData = querystring.parse(body)
      const state = stringToJson(queryData.state)
      debug(`state: ${JSON.stringify(state)}`)
      debug(`queryData: ${JSON.stringify(queryData)}`)

      if (queryData.code && state.id === id) {
        resolve(codeTransform(queryData.code, queryData.code_type))
        response.statusCode = 200
        response.end('You are now signed in, please close this window.')
      } else {
        response.statusCode = 400
        response.end('An error occurred in the cli.')
        reject(new Error(`error code=${queryData.code}`))
      }
      done()
    })
  })
}

/**
 * Unsupported HTTP method handler.
 *
 * @param {object} request the Request object
 * @param {object} response the Response object
 * @param {string} [env=prod] the IMS environment
 */
function handleUnsupportedHttpMethod (request, response, env = DEFAULT_ENV) {
  response.statusCode = 405
  cors(response, env).end('Supported HTTP methods are OPTIONS, POST')
}

module.exports = {
  handlePOST,
  handleOPTIONS,
  handleUnsupportedHttpMethod,
  codeTransform,
  cors,
  stringToJson,
  randomId,
  authSiteUrl,
  createServer,
  IMS_CLI_OAUTH_URL
}
