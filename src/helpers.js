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
 * @param {string} _url the url to construct
 * @param {object} queryParams the query params to add to the url
 * @returns {string} the constructed url
 */
function authSiteUrl (_url, queryParams) {
  const uri = new url.URL(_url)
  Object.keys(queryParams).forEach(key => {
    if (queryParams[key]) {
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
 * Gets the relevant query data from the request query parameters.
 *
 * @param {*} request a Request object
 * @returns {object} an object containing the request's query data
 */
function getQueryDataFromRequest (request) {
  const _url = new url.URL(request.url, `http://${request.headers.host}`)
  const queryData = _url.searchParams

  return iterableToObject(queryData.entries())
}

/**
 * Convert an iterable to an object.
 *
 * @private
 * @param {object} entries an iterator
 * @returns {object} the converted iterator as an object
 **/
function iterableToObject (entries) {
  const result = {}
  for (const entry of entries) {
    const [key, value] = entry
    result[key] = value
  }
  return result
}

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

module.exports = {
  stringToJson,
  iterableToObject,
  getQueryDataFromRequest,
  randomId,
  authSiteUrl,
  createServer
}
