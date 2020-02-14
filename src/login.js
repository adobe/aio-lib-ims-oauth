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
const querystring = require('querystring')
const ora = require('ora')
const url = require('url')
const { cli } = require('cli-ux')
const { randomId, authSiteUrl, createServer, stringToJson } = require('./helpers')

const AUTH_TIMEOUT_SECONDS = 120
const AUTH_URL = 'https://adobeioruntime.net/api/v1/web/53444_51636/default/appLogin/'

const cors = (response) => {
  response.setHeader('Content-Type', 'text/plain')
  response.setHeader('Access-Control-Allow-Origin', new url.URL(AUTH_URL).origin)
  response.setHeader('Access-Control-Request-Method', '*')
  response.setHeader('Access-Control-Allow-Methods', 'OPTIONS, POST')
  response.setHeader('Access-Control-Allow-Headers', '*')

  return response
}

const codeTransform = (code, codeType) => {
  if (codeType === 'access_token') {
    return JSON.parse(code)
  }

  return code
}

const handleOPTIONS = (request, response) => {
  cors(response).end()
}

const handlePOST = async (request, response, id, done) => {
  return new Promise((resolve, reject) => {
    cors(response)
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

const handleUnsupportedHttpMethod = (request, response) => {
  response.statusCode = 405
  cors(response).end('Supported HTTP methods are OPTIONS, POST')
}

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
  const uri = authSiteUrl(AUTH_URL, { id, port: serverPort, client_id, scope, redirect_uri })

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
        spinner.stop()
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
        spinner.fail()
        reject(error)
      }
    })
  })
}

module.exports = login
