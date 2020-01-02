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

const http = require('http')
const debug = require('debug')('aio-cli-plugin-oauth2')
const url = require('url')
const crypto = require('crypto')

/**
 * Create a local server to wait for browser callback.
 *
 * @param {*} options
 */
async function createServer ({ hostname = '127.0.0.1', port = 8000 } = {}) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const _url = new url.URL(req.url, `http://${req.headers.host}`)
      const queryData = _url.searchParams
      let state

      if (queryData && (state = queryData.get('state'))) {
        const resultData = JSON.parse(state)
        resultData.code = queryData.get('code')
        resolve(resultData)
      } else {
        reject(new Error('No query data to get the authorization code from'))
      }

      res.statusCode = 200
      res.setHeader('Content-Type', 'text/plain')
      res.end('You are now logged in, you may close this window\n')

      server.close()
    })
    server.listen(port, hostname, () => {
      debug(`Login callback server running at http://${hostname}:${port}/`)
    })
  })
}

/**
 * Construct the auth site url with these query params.
 *
 * @param {*} queryParams
 */
function authSiteUrl (_url, queryParams) {
  const uri = new url.URL(_url)
  Object.keys(queryParams).forEach(key => {
    uri.searchParams.set(key, queryParams[key])
  })
  return uri.href
}

/**
 * Generates a random 4 character hex id.
 */
const randomId = () => crypto.randomBytes(4).toString('hex')

module.exports = {
  createServer,
  randomId,
  authSiteUrl
}
