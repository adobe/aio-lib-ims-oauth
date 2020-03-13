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
  IMS_CLI_OAUTH_URL, randomId, authSiteUrl, createServer, handlePOST, stringToJson, handleUnsupportedHttpMethod,
  handleOPTIONS, codeTransform
} = require('../src/helpers')

const http = require('http')
const querystring = require('querystring')

jest.mock('http')

const gMockResponse = {
  setHeader: jest.fn(),
  end: jest.fn(),
  statusCode: null
}

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
  expect(typeof createServer).toEqual('function')
  expect(typeof randomId).toEqual('function')
  expect(typeof authSiteUrl).toEqual('function')
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

  http.createServer.mockImplementation(callback => {
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

test('authSiteUrl', () => {
  let queryParams

  queryParams = { a: 'b', c: 'd' }
  expect(authSiteUrl(queryParams)).toEqual(`${IMS_CLI_OAUTH_URL}?a=b&c=d`)

  queryParams = { a: 'b', c: 'd', e: undefined, f: null }
  expect(authSiteUrl(queryParams)).toEqual(`${IMS_CLI_OAUTH_URL}?a=b&c=d`)
})

test('handlePOST', async () => {
  const id = 'abcd'
  let state = {}
  let queryData = {}
  const done = jest.fn()
  const authCode = 'my-auth-code'

  const createRequest = () => {
    const evts = {}

    return {
      on: (event, callback) => {
        evts[event] = callback
      },
      fire: (event, data) => {
        evts[event] && evts[event](data)
      }
    }
  }

  const req = createRequest()
  state = { id }
  queryData = { code_type: 'auth_code', code: authCode, state: JSON.stringify(state) }

  setTimeout(() => {
    req.fire('data', querystring.stringify(queryData))
    req.fire('end')
  }, 100)
  await expect(handlePOST(req, gMockResponse, id, done)).resolves.toEqual(authCode)

  setTimeout(() => {
    req.fire('data', querystring.stringify(queryData))
    req.fire('end')
  }, 100)
  await expect(handlePOST(req, gMockResponse, 'an-altered-id', done)).rejects.toEqual(new Error(`error code=${authCode}`))
})

test('handleUnsupportedHttpMethod', async () => {
  const req = { method: 'GET' }
  const res = {
    setHeader: jest.fn(),
    end: jest.fn(),
    statusCode: null
  }

  handleUnsupportedHttpMethod(req, res)
  expect(res.statusCode).toEqual(405)
  expect(res.end).toHaveBeenCalled()
})

test('handleOPTIONS', async () => {
  const req = { method: 'OPTIONS' }
  const res = {
    setHeader: jest.fn(),
    end: jest.fn(),
    statusCode: null
  }

  handleOPTIONS(req, res)
  expect(res.end).toHaveBeenCalled()
})

test('codeTransform', async () => {
  let code

  code = 'my-code'
  expect(codeTransform(code, 'auth_code')).toEqual(code)

  code = { access_token: 'my-access-token' }
  expect(codeTransform(JSON.stringify(code), 'access_token')).toEqual(code)
})
