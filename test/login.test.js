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

// //////////////////////////////////////////

jest.mock('cli-ux')
jest.mock('../src/helpers')
jest.mock('ora')

ora.mockImplementation(() => {
  return {
    start: () => {
      return {
        info: jest.fn(),
        stop: jest.fn(),
        fail: jest.fn()
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

const createMockResponse = () => ({
  setHeader: jest.fn(),
  end: jest.fn(),
  statusCode: null,
  writeHead: jest.fn()
})

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
function createMockServer (request, response, port = 8000, delayTriggerMs = 100) {
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

beforeAll(() => {
  jest.useRealTimers()
})

afterAll(() => {
  jest.useFakeTimers()
})

beforeEach(() => {
  jest.clearAllMocks()
})

test('exports', () => {
  expect(typeof login).toEqual('function')
})

test('login (POST)', async () => {
  const myAuthCode = 'my-auth-code'
  const myAccessToken = { access_token: { token: 'my-access-token', expiry: 123 } }
  const myRandomId = 'random-id'
  const request = { method: 'POST' }

  helpers.randomId.mockImplementation(() => myRandomId)
  helpers.createServer.mockImplementation(() => {
    return new Promise(resolve => {
      resolve(createMockServer(request, createMockResponse()))
    })
  })

  const createPostResponse = (responseValue) => {
    return async function (_req, _resp, _id, done) {
      done()
      return responseValue
    }
  }

  // Success (got auth code)
  helpers.handlePOST.mockImplementation(await createPostResponse(myAuthCode))
  await expect(login(gConfig)).resolves.toEqual(myAuthCode)
  expect(cli.url.mock.calls.length).toEqual(1)
  expect(cli.open.mock.calls.length).toEqual(1)

  // Success (got access token)
  helpers.handlePOST.mockImplementation(await createPostResponse(myAccessToken))
  await expect(login(gConfig)).resolves.toEqual(myAccessToken)

  // Success (bare output)
  helpers.handlePOST.mockImplementation(await createPostResponse(myAccessToken))
  await expect(login({ ...gConfig, bare: true })).resolves.toEqual(myAccessToken)
})

test('login (GET)', async () => {
  const myAuthCode = 'my-auth-code'
  const myAccessToken = { access_token: { token: 'my-access-token', expiry: 123 } }
  const myRandomId = 'random-id'
  const request = { method: 'GET' }

  helpers.randomId.mockImplementation(() => myRandomId)
  helpers.createServer.mockImplementation(() => {
    return new Promise(resolve => {
      resolve(createMockServer(request, createMockResponse()))
    })
  })

  const createGetResponse = (responseValue) => {
    return async function (_req, _resp, _id, done) {
      done()
      return responseValue
    }
  }

  // Success (got auth code)
  helpers.handleGET.mockImplementation(await createGetResponse(myAuthCode))
  await expect(login(gConfig)).resolves.toEqual(myAuthCode)
  expect(cli.url.mock.calls.length).toEqual(1)
  expect(cli.open.mock.calls.length).toEqual(1)

  // Success (got access token)
  helpers.handleGET.mockImplementation(await createGetResponse(myAccessToken))
  await expect(login(gConfig)).resolves.toEqual(myAccessToken)

  // Success (bare output)
  helpers.handleGET.mockImplementation(await createGetResponse(myAccessToken))
  await expect(login({ ...gConfig, bare: true })).resolves.toEqual(myAccessToken)
})

test('error', async () => {
  const request = { method: 'POST' }
  const myAuthCode = 'my-auth-code'

  // Error (state id does not match)
  helpers.createServer.mockImplementation(() => {
    return new Promise(resolve => {
      resolve(createMockServer(request, createMockResponse()))
    })
  })

  const error = new Error(`error code=${myAuthCode}`)
  helpers.handlePOST.mockImplementation(() => Promise.reject(error))
  await expect(login(gConfig)).rejects.toEqual(error)

  await expect(login({ ...gConfig, bare: true })).rejects.toEqual(error)
})

test('timeout', async () => {
  const myTimeout = 1

  helpers.createServer.mockImplementation(() => {
    return new Promise(resolve => {
      resolve(createMockServer({}, createMockResponse(), null, 10000))
    })
  })

  // Timeout not bare (default)
  await expect(login({ ...gConfig, timeout: myTimeout })).rejects.toEqual(new Error(`Timed out after ${myTimeout} seconds.`))
  // Timeout bare
  await expect(login({ ...gConfig, timeout: myTimeout, bare: true })).rejects.toEqual(new Error(`Timed out after ${myTimeout} seconds.`))
})

test('unsupported http method', () => {
  // Unsupported method
  const request = { method: 'PUT' }
  helpers.createServer.mockImplementation(() => {
    return new Promise(resolve => {
      resolve(createMockServer(request, createMockResponse()))
    })
  })

  return new Promise(resolve => {
    helpers.handleUnsupportedHttpMethod.mockImplementation((req, res) => {
      expect(req.method).toEqual('PUT')
      resolve()
    })
    login(gConfig)
  })
})

test('OPTIONS http method', () => {
  const request = { method: 'OPTIONS' }
  helpers.createServer.mockImplementation(() => {
    return new Promise(resolve => {
      resolve(createMockServer(request, createMockResponse()))
    })
  })

  return new Promise(resolve => {
    helpers.handleOPTIONS.mockImplementation((req, res) => {
      expect(req.method).toEqual('OPTIONS')
      resolve()
    })
    login(gConfig)
  })
})
