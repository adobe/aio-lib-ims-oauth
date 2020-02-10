/*
Copyright 2018 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/

const helpers = require('../src/helpers')
const { cli } = require('cli-ux')
const ora = require('ora')
const login = require('../src/login')
const url = require('url')

// //////////////////////////////////////////

jest.mock('cli-ux')
jest.mock('../src/helpers')
jest.mock('ora')

const { getQueryDataFromRequest, stringToJson } = jest.requireActual('../src/helpers')
helpers.getQueryDataFromRequest.mockImplementation(getQueryDataFromRequest) // use actual
helpers.stringToJson.mockImplementation(stringToJson) // use actual

ora.mockImplementation(() => {
  return {
    start: () => {
      return {
        info: jest.fn(),
        stop: jest.fn()
      }
    }
  }
})

const gConfig = {
  client_id: 'my-client-id',
  client_secret: 'my-client-secret',
  scope: 'my,meta,scopes',
  redirect_uri: 'https://auth.url'
}

jest.spyOn(console, 'log').mockImplementation(() => {})
// not sure why this method is not mocked by jest, so we manually do it
cli.open = jest.fn()

const gMockResponse = {
  setHeader: jest.fn(),
  end: jest.fn(),
  statusCode: null
}
/**
 * Create a mock http.server object
 *
 * @private
 * @param {object} request the request to trigger
 * @param {object} response the response to trigger
 * @param {number} port the port number
 * @param {number} [delayTriggerMs=100] the delay in triggering the request callback
 * @returns {object} the mock http.server object
 */
function createMockServer (request, response, port, delayTriggerMs = 100) {
  return {
    listen: jest.fn(),
    close: jest.fn(),
    on: jest.fn((event, callback) => {
      if (event === 'listening') {
        setTimeout(callback, 100)
      } else if (event === 'request') {
        setTimeout(() => callback(request, response), delayTriggerMs)
      }
    }),
    address: jest.fn(() => ({ port }))
  }
}

/**
 * Create a mock Request object.
 *
 * @private
 * @param {string} host the host name
 * @param {object} state the state object
 * @param {string} authCode the auth code
 * @returns {object} the mock Request object
 */
function createMockRequest (host, state, authCode) {
  const _url = new url.URL(host)
  _url.searchParams.set('state', JSON.stringify(state))
  _url.searchParams.set('code', authCode)
  _url.searchParams.set('code_type', 'auth_code')

  return {
    url: _url.toString(),
    headers: {
      host: host
    }
  }
}

// //////////////////////////////////////////

beforeAll(() => {
  jest.useRealTimers()
})

afterAll(() => {
  jest.useFakeTimers()
})

beforeEach(() => {
  jest.restoreAllMocks()
})

test('exports', () => {
  expect(typeof login).toEqual('function')
})

test('login', async () => {
  const myAuthCode = 'my-auth-code'
  const myRandomId = 'random-id'
  const myPort = 8000
  const myHost = 'http://my.host'
  const myState = {
    id: myRandomId,
    port: myPort
  }
  let request

  helpers.randomId.mockImplementation(() => myRandomId)

  // Success (got auth code)
  request = createMockRequest(myHost, myState, myAuthCode)
  helpers.createServer.mockImplementation(() => {
    return new Promise(resolve => {
      resolve(createMockServer(request, gMockResponse, myPort))
    })
  })

  await expect(login(gConfig)).resolves.toEqual(myAuthCode)
  expect(cli.url.mock.calls.length).toEqual(1)
  expect(cli.open.mock.calls.length).toEqual(1)

  // Timeout
  helpers.createServer.mockImplementation(() => {
    return new Promise(resolve => {
      resolve(createMockServer(request, gMockResponse, myPort, 10000))
    })
  })

  await expect(login({ ...gConfig, timeout: 1 })).rejects.toEqual(new Error('Timed out after 1 seconds.'))

  // Error (state id does not match)
  request = createMockRequest(myHost, { id: 'this-was-changed-somewhere', port: myPort }, myAuthCode)
  helpers.createServer.mockImplementation(() => {
    return new Promise(resolve => {
      resolve(createMockServer(request, gMockResponse, myPort))
    })
  })
  await expect(login(gConfig)).rejects.toEqual(new Error('error code=my-auth-code'))
})
