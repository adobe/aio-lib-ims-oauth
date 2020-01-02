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

const { createServer, randomId, authSiteUrl } = require('../src/helpers')
const http = require('http')

jest.mock('http')

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
  const state = {
    code: 'my-auth-code'
  }

  const server = {
    listen: jest.fn((port, hostname, callback) => {
      setTimeout(callback, 500)
    }),
    close: jest.fn()
  }

  http.createServer.mockImplementation(callback => {
    const req = {
      headers: {
        host: 'my-server.com'
      },
      url: `/foo/bar?state={}&code=${state.code}`
    }

    const res = {
      end: jest.fn(),
      setHeader: jest.fn(),
      statusCode: 0
    }

    setTimeout(() => callback(req, res), 500)
    return server
  })

  await expect(createServer()).resolves.toEqual(state)

  http.createServer.mockImplementation(callback => {
    const req = {
      headers: {
        host: 'my-server.com'
      },
      url: '/foo/bar/'
    }

    const res = {
      end: jest.fn(),
      setHeader: jest.fn(),
      statusCode: 0
    }

    setTimeout(() => callback(req, res), 500)
    return server
  })

  await expect(createServer()).rejects.toEqual(new Error('No query data to get the authorization code from'))
})

test('randomId', () => {
  const r1 = randomId()
  const r2 = randomId()

  expect(r1).not.toEqual(r2)
  expect(r1.length).toEqual(8)
})

test('authSiteUrl', () => {
  const url = 'https://adobe.com'
  const queryParams = { a: 'b', c: 'd' }

  expect(authSiteUrl(url, queryParams)).toEqual('https://adobe.com/?a=b&c=d')
})
