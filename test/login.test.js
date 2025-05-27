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
const { authSiteUrl, getImsCliOAuthUrl } = jest.requireActual('../src/helpers')
const open = require('open')
const login = require('../src/login')
const url = require('url')
const { stderr } = require('stdout-stderr')
const ciInfo = require('ci-info')
const errors = require('../src/errors')

// //////////////////////////////////////////

jest.mock('../src/helpers')
jest.mock('open', () => jest.fn())
jest.mock('ci-info')

const mockOraSpinnerInstance = {
  fail: jest.fn(),
  succeed: jest.fn(),
  start: jest.fn(() => mockOraSpinnerInstance),
  stopAndPersist: jest.fn(options => {
    if (options && options.text) {
      process.stderr.write(options.text + '\n')
    }
    return mockOraSpinnerInstance
  }),
  info: jest.fn(() => mockOraSpinnerInstance)
}

jest.mock('ora', () => jest.fn().mockImplementation(() => mockOraSpinnerInstance))

const ora = require('ora')

const gConfig = {
  client_id: 'my-client-id',
  client_secret: 'my-client-secret',
  scope: 'my,meta,scopes',
  redirect_uri: 'https://auth.url'
}

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
 * @param {object | Array<object>} request the request to trigger
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
        setTimeout(() => {
          if (Array.isArray(request)) {
            request.forEach((req) => {
              callback(req, response)
            })
          } else {
            callback(request, response)
          }
        }, delayTriggerMs)
      } else {
        throw new Error(`Unexpected event: ${event}`)
      }
    }),
    address: jest.fn(() => ({ port }))
  }
}

beforeAll(() => {
  // unmock authSiteUrl, getImsCliOAuthUrl from helpers
  helpers.authSiteUrl.mockImplementation(authSiteUrl)
  helpers.getImsCliOAuthUrl.mockImplementation(getImsCliOAuthUrl)
  jest.useRealTimers()
})

afterAll(() => {
  jest.useFakeTimers()
})

beforeEach(() => {
  jest.clearAllMocks()
  stderr.start()
  ciInfo.isCI = false
})

afterEach(() => {
  stderr.stop()
})

test('exports', () => {
  expect(typeof login).toEqual('function')
})

test('the url returned by open, no query params should contain undefined', async () => {
  const request = { method: 'GET' }
  helpers.createServer.mockImplementation(() => {
    return new Promise(resolve => {
      resolve(createMockServer(request, createMockResponse()))
    })
  })

  // to handle timer cleanup duties
  helpers.handleGET.mockImplementation((_req, _res, _id, done) => done())

  await login({ bare: false, ...gConfig })
  expect(open.mock.calls.length).toEqual(1)
  expect(stderr.output).toMatch(/Visit this url to log in:\n/)

  // ACNA-1315 - test the url returned by cli.open, no query param values should contain undefined
  const cliOpenCallUrl = new url.URL(open.mock.calls[0][0])
  for (const [, value] of cliOpenCallUrl.searchParams.entries()) {
    expect(value).not.toMatch('undefined')
  }
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

  // to handle timer cleanup duties
  helpers.handlePOST.mockImplementation((_req, _res, _id, done) => done())

  const createPostResponse = (responseValue) => {
    return async function (_req, _resp, _id, done) {
      done()
      return responseValue
    }
  }

  // Success (got auth code)
  helpers.handlePOST.mockImplementation(await createPostResponse(myAuthCode))
  await expect(login(gConfig)).resolves.toEqual(myAuthCode)
  expect(open.mock.calls.length).toEqual(1)

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

  // to handle timer cleanup duties
  helpers.handleGET.mockImplementation((_req, _res, _id, done) => done())

  const createGetResponse = (responseValue) => {
    return async function (_req, _resp, _id, done) {
      done()
      return responseValue
    }
  }

  // Success (got auth code)
  helpers.handleGET.mockImplementation(await createGetResponse(myAuthCode))
  await expect(login(gConfig)).resolves.toEqual(myAuthCode)
  expect(open.mock.calls.length).toEqual(1)

  // Success (got access token)
  helpers.handleGET.mockImplementation(await createGetResponse(myAccessToken))
  await expect(login(gConfig)).resolves.toEqual(myAccessToken)

  // Success (bare output)
  helpers.handleGET.mockImplementation(await createGetResponse(myAccessToken))
  await expect(login({ ...gConfig, bare: true })).resolves.toEqual(myAccessToken)
})

test('open:false', async () => {
  const myAccessToken = { access_token: { token: 'my-access-token', expiry: 123 } }
  await expect(login({ ...gConfig, open: false })).resolves.toEqual(myAccessToken)
  expect(open.mock.calls.length).toEqual(0)
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
  const mockServer = createMockServer({}, createMockResponse(), null, 10000)
  mockServer.on = jest.fn() // prevent timer leaks

  helpers.createServer.mockImplementation(() => {
    return new Promise(resolve => {
      resolve(mockServer)
    })
  })

  // Timeout not bare (default)
  await expect(login({ ...gConfig, timeout: myTimeout })).rejects.toThrow(`[IMSOAuthSDK:TIMEOUT] Timed out after ${myTimeout} seconds.`)
  // Timeout bare
  await expect(login({ ...gConfig, timeout: myTimeout, bare: true })).rejects.toThrow(`[IMSOAuthSDK:TIMEOUT] Timed out after ${myTimeout} seconds.`)
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
    helpers.handleUnsupportedHttpMethod.mockImplementation((req, _res, done) => {
      expect(req.method).toEqual('PUT')
      resolve()
      done() // to handle timer cleanup duties
    })
    login(gConfig)
  })
})

test('OPTIONS http method', () => {
  const requests = [{ method: 'OPTIONS' }, { method: 'GET' }]
  helpers.createServer.mockImplementation(() => {
    return new Promise(resolve => {
      resolve(createMockServer(requests, createMockResponse()))
    })
  })

  return new Promise(resolve => {
    helpers.handleOPTIONS.mockImplementation((req, _res, done) => {
      expect(req.method).toEqual('OPTIONS')
      done && done()
    })
    // to handle timer cleanup duties
    helpers.handleGET.mockImplementation((_req, _res, _id, done) => {
      resolve()
      done()
    })
    login(gConfig)
  })
})

test('browser config is passed to open', async () => {
  const request = { method: 'GET' }
  helpers.createServer.mockImplementation(() => {
    return new Promise(resolve => {
      resolve(createMockServer(request, createMockResponse()))
    })
  })
  // to handle timer cleanup duties
  helpers.handleGET.mockImplementation((_req, _res, _id, done) => done())

  await login({ browser: 'Firefox', ...gConfig })
  expect(open.mock.calls.length).toEqual(1)

  const openOptions = open.mock.calls[0][1]
  expect(openOptions.app).toEqual('Firefox')
})

test('login in CI environment (not bare)', async () => {
  ciInfo.isCI = true // Simulate CI environment
  const config = { ...gConfig, bare: false } // Not bare

  await expect(login(config)).rejects.toThrow(new errors.codes.IMSOAUTHCLI_LOGIN_CI_ERROR())
  expect(ora).toHaveBeenCalledTimes(1) // ora constructor should be called
  expect(mockOraSpinnerInstance.fail).toHaveBeenCalledWith('CI Environment: Interactive login not supported. Use technical account via env vars for authentication. For guidance, see https://github.com/adobe/aio-apps-action')
  expect(open).not.toHaveBeenCalled() // Ensure browser open was not attempted
})

test('login in CI environment (bare)', async () => {
  ciInfo.isCI = true // Simulate CI environment
  const config = { ...gConfig, bare: true } // Bare mode

  await expect(login(config)).rejects.toThrow(new errors.codes.IMSOAUTHCLI_LOGIN_CI_ERROR())
  expect(ora).not.toHaveBeenCalled() // Ensure ora constructor was NOT called in bare mode
  expect(open).not.toHaveBeenCalled() // Ensure browser open was not attempted
})
