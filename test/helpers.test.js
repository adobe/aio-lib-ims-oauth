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

const { stringToJson, iterableToObject, getQueryDataFromRequest, randomId, authSiteUrl, createServer } = require('../src/helpers')
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

test('iterableToObject', () => {
  const params = new URLSearchParams()
  expect(iterableToObject(params)).toEqual({})

  params.set('foo', 'bar')
  expect(iterableToObject(params)).toEqual({ foo: 'bar' })
})

test('getQueryDataFromRequest', () => {
  let request
  const host = 'http://foo.bar/'

  request = { url: `${host}?foo=bar`, headers: { host } }
  expect(getQueryDataFromRequest(request)).toEqual({ foo: 'bar' })

  request = { url: host, headers: { host } }
  expect(getQueryDataFromRequest(request)).toEqual({})
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
