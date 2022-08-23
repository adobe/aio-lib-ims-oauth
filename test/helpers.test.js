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

const {
  IMS_CLI_OAUTH_URL, randomId, authSiteUrl, createServer, getImsCliOAuthUrl, cors, handleGET, handlePOST, stringToJson, handleUnsupportedHttpMethod,
  handleOPTIONS, codeTransform
} = require('../src/helpers')

const http = require('http')
const querystring = require('querystring')
const url = require('url')
const libEnv = require('@adobe/aio-lib-env')
const { STAGE_ENV, PROD_ENV } = jest.requireActual('@adobe/aio-lib-env')

jest.mock('@adobe/aio-lib-env')
jest.mock('http')

const createMockResponse = () => ({
  setHeader: jest.fn(),
  end: jest.fn(),
  statusCode: null,
  writeHead: jest.fn()
})

const createRequest = ({ url } = {}) => {
  const evts = {}

  return {
    url,
    on: (event, callback) => {
      evts[event] = callback
    },
    fire: (event, data) => {
      evts[event] && evts[event](data)
    }
  }
}

beforeAll(() => {
  jest.useRealTimers()
})

afterAll(() => {
  jest.useFakeTimers()
})

beforeEach(() => {
  jest.restoreAllMocks()
  libEnv.getCliEnv.mockReturnValue(PROD_ENV) // default
})

test('exports', () => {
  expect(typeof IMS_CLI_OAUTH_URL).toEqual('object')
  expect(typeof createServer).toEqual('function')
  expect(typeof randomId).toEqual('function')
  expect(typeof authSiteUrl).toEqual('function')
  expect(typeof getImsCliOAuthUrl).toEqual('function')
  expect(typeof cors).toEqual('function')
  expect(typeof handleGET).toEqual('function')
  expect(typeof handlePOST).toEqual('function')
  expect(typeof stringToJson).toEqual('function')
  expect(typeof handleUnsupportedHttpMethod).toEqual('function')
  expect(typeof handleOPTIONS).toEqual('function')
  expect(typeof codeTransform).toEqual('function')
})

test('createServer', async () => {
  const server = {
    listen: jest.fn(),
    close: jest.fn(),
    on: jest.fn((event, callback) => {
      if (event === 'listening') {
        setTimeout(callback, 100)
      }
    })
  }

  http.createServer.mockImplementation((_) => {
    return server
  })

  await expect(createServer()).resolves.toEqual(server)
})

test('stringToJson', () => {
  expect(stringToJson('{')).toEqual({})
  expect(stringToJson('{ "foo": "bar" }')).toEqual({ foo: 'bar' })
})

test('randomId', () => {
  const r1 = randomId()
  const r2 = randomId()

  expect(r1).not.toEqual(r2)
  expect(r1.length).toEqual(8)
})

test('getImsCliOAuthUrl', () => {
  let env, url

  // success (prod)
  env = PROD_ENV
  url = IMS_CLI_OAUTH_URL[env]
  expect(getImsCliOAuthUrl(env)).toEqual(url)

  // coverage (default env)
  env = undefined
  expect(getImsCliOAuthUrl(env)).toEqual(url)

  // success (stage)
  env = STAGE_ENV
  url = IMS_CLI_OAUTH_URL[env]
  expect(getImsCliOAuthUrl(env)).toEqual(url)

  // env set via global config (stage)
  env = STAGE_ENV
  libEnv.getCliEnv.mockReturnValue(env)
  url = IMS_CLI_OAUTH_URL[env]
  expect(getImsCliOAuthUrl()).toEqual(url)

  // env set via global config (prod)
  env = PROD_ENV
  libEnv.getCliEnv.mockReturnValue(env)
  url = IMS_CLI_OAUTH_URL[env]
  expect(getImsCliOAuthUrl()).toEqual(url)

  // env set via parameter overrides global config
  env = STAGE_ENV
  libEnv.getCliEnv.mockReturnValue(PROD_ENV)
  url = IMS_CLI_OAUTH_URL[env]
  expect(getImsCliOAuthUrl(env)).toEqual(url)
})

test('authSiteUrl', () => {
  let queryParams, env, url

  // success (prod)
  env = PROD_ENV
  url = IMS_CLI_OAUTH_URL[env]
  queryParams = { a: 'b', c: 'd' }
  expect(authSiteUrl(queryParams, env)).toEqual(`${url}?a=b&c=d`)

  // coverage (default env)
  env = undefined
  queryParams = { a: 'b', c: 'd', e: undefined, f: null }
  expect(authSiteUrl(queryParams, env)).toEqual(`${url}?a=b&c=d`)

  // success (stage)
  env = STAGE_ENV
  url = IMS_CLI_OAUTH_URL[env]
  queryParams = { a: 'b', c: 'd', e: undefined, f: null }
  expect(authSiteUrl(queryParams, env)).toEqual(`${url}?a=b&c=d`)

  // env set via global config (stage)
  env = STAGE_ENV
  libEnv.getCliEnv.mockReturnValue(env)
  url = IMS_CLI_OAUTH_URL[env]
  queryParams = { a: 'b', c: 'd' }
  expect(authSiteUrl(queryParams)).toEqual(`${url}?a=b&c=d`)

  // env set via global config (prod)
  env = PROD_ENV
  libEnv.getCliEnv.mockReturnValue(env)
  url = IMS_CLI_OAUTH_URL[env]
  queryParams = { a: 'b', c: 'd', f: undefined }
  expect(authSiteUrl(queryParams)).toEqual(`${url}?a=b&c=d`)

  // env set via parameter overrides global config
  env = STAGE_ENV
  libEnv.getCliEnv.mockReturnValue(PROD_ENV)
  url = IMS_CLI_OAUTH_URL[env]
  queryParams = { a: 'b', c: 'd', f: undefined }
  expect(authSiteUrl(queryParams, env)).toEqual(`${url}?a=b&c=d`)
})

test('handleGET', async () => {
  const id = 'abcd'
  let state = {}
  let queryData = {}
  const done = jest.fn()
  const authCode = 'my-auth-code'

  state = { id }
  queryData = { code_type: 'auth_code', code: authCode, state: JSON.stringify(state) }
  const url = `/?${querystring.stringify(queryData)}`
  const req = createRequest({ url })

  // success
  await expect(handleGET(req, createMockResponse(), id, done)).resolves.toEqual(authCode)

  // failure
  await expect(handleGET(req, createMockResponse(), 'an-altered-id', done)).rejects.toThrow(`[IMSOAuthSDK:HTTP_ERROR] error code=${authCode}`)
})

test('handlePOST', async () => {
  const id = 'abcd'
  let state = {}
  let queryData = {}
  const done = jest.fn()
  const authCode = 'my-auth-code'

  const req = createRequest()
  state = { id }
  queryData = { code_type: 'auth_code', code: authCode, state: JSON.stringify(state) }

  setTimeout(() => {
    req.fire('data', querystring.stringify(queryData))
    req.fire('end')
  }, 100)
  await expect(handlePOST(req, createMockResponse(), id, done)).resolves.toEqual(authCode)

  setTimeout(() => {
    req.fire('data', querystring.stringify(queryData))
    req.fire('end')
  }, 100)
  await expect(handlePOST(req, createMockResponse(), 'an-altered-id', done)).rejects.toThrow(`[IMSOAuthSDK:HTTP_ERROR] error code=${authCode}`)
})

test('handleUnsupportedHttpMethod', async () => {
  const req = { method: 'PUT' }
  const res = {
    setHeader: jest.fn(),
    end: jest.fn(),
    statusCode: null
  }
  const done = jest.fn()

  handleUnsupportedHttpMethod(req, res, done)
  expect(res.statusCode).toEqual(405)
  expect(res.end).toHaveBeenCalled()
  expect(done).toHaveBeenCalledTimes(1)
})

test('handleOPTIONS', async () => {
  const req = { method: 'OPTIONS' }
  const res = {
    setHeader: jest.fn(),
    end: jest.fn(),
    statusCode: null
  }
  const done = jest.fn()

  handleOPTIONS(req, res, done)
  expect(res.end).toHaveBeenCalled()
  expect(done).toHaveBeenCalledTimes(1)
})

test('codeTransform', async () => {
  let code

  code = 'my-code'
  expect(codeTransform(code, 'auth_code')).toEqual(code)

  code = { access_token: 'my-access-token' }
  expect(codeTransform(JSON.stringify(code), 'access_token')).toEqual(code)
})

test('cors', () => {
  let env, origin
  const headers = {}
  const response = {
    setHeader: (header, value) => {
      headers[header] = value
    }
  }

  const allowOriginHeader = 'Access-Control-Allow-Origin'

  // prod env
  env = PROD_ENV
  cors(response, env)
  origin = new url.URL(IMS_CLI_OAUTH_URL[env]).origin
  expect(headers[allowOriginHeader]).toEqual(origin)

  // stage env
  env = STAGE_ENV
  cors(response, env)
  origin = new url.URL(IMS_CLI_OAUTH_URL[env]).origin
  expect(headers[allowOriginHeader]).toEqual(origin)

  // default env (coverage)
  env = PROD_ENV
  cors(response) // default
  origin = new url.URL(IMS_CLI_OAUTH_URL[env]).origin
  expect(headers[allowOriginHeader]).toEqual(origin)
})
