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

jest.mock('cli-ux')
jest.mock('../src/helpers')
jest.mock('ora')

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
  port: 8000,
  auth_url: 'https://auth.url'
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
  expect(typeof login).toEqual('function')
})

test('login', async () => {
  const myAuthCode = 'my-auth-code'
  const myRandomId = 'random-id'

  helpers.randomId.mockImplementation(() => myRandomId)
  helpers.createServer.mockImplementation(() => {
    return new Promise(resolve => {
      resolve({
        code: myAuthCode,
        id: myRandomId
      })
    })
  })

  jest.spyOn(console, 'log').mockImplementation(() => {})

  // not sure why this method is not mocked by jest, so we manually do it
  cli.open = jest.fn()

  // expect success
  await expect(login(gConfig)).resolves.toEqual(myAuthCode)
  expect(cli.url.mock.calls.length).toEqual(1)
  expect(cli.open.mock.calls.length).toEqual(1)

  // expect error, state.id mismatch
  helpers.randomId.mockImplementation(() => 'elverum')
  await expect(login(gConfig)).rejects.toEqual(new Error(`error code=${myAuthCode}`))

  // expect error, timeout
  gConfig.timeout = 3 // seconds
  delete gConfig.port // remove the port, use default (for coverage)
  helpers.createServer.mockImplementation(() => new Promise(() => {})) // never resolves
  await expect(login(gConfig)).rejects.toEqual(new Error(`Timed out after ${gConfig.timeout} seconds.`))
})
