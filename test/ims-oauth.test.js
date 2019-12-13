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

const plugin = require('../src/ims-oauth')
const Electron = require('../src/electron')

jest.mock('../src/electron')

const gIms = {
  getAccessToken: jest.fn(),
  getApiUrl: jest.fn(),
  getSusiUrl: jest.fn()
}

const gConfig = {
  client_id: 'my-client-id',
  client_secret: 'my-client-secret',
  scope: 'my,scope',
  callback_url: 'my-callback-url'
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

test('has ims plugin interface', () => {
  expect(typeof plugin.supports).toEqual('function')
  expect(typeof plugin.imsLogin).toEqual('function')
})

test('supports() interface', () => {
  expect(plugin.supports(gConfig)).toBeTruthy()
  expect(plugin.supports({})).toBeFalsy()
  expect(plugin.supports()).toBeFalsy()
})

test('imsLogin() interface', async () => {
  const myAccessToken = 'my-access-token'
  const myAuthCode = 'my-auth-code'

  gIms.getAccessToken.mockImplementation((authCode, clientId, clientSecret, scope) => {
    expect(authCode).toEqual(myAuthCode)
    expect(clientId).toEqual(gConfig.client_id)
    expect(clientSecret).toEqual(gConfig.client_secret)
    expect(scope).toEqual(gConfig.scope)
    return 'my-access-token'
  })

  // successful login, with auth code returned
  Electron.mockImplementation(() => {
    return {
      launch: (electronCallback) => {
        setTimeout(() => { // use for polling the electron result in the plugin
          electronCallback(myAuthCode)
        }, 500)
      }
    }
  })

  await expect(plugin.imsLogin(gIms, gConfig)).resolves.toEqual(myAccessToken)

  // error login, with Error returned
  Electron.mockImplementation(() => {
    return {
      launch: (electronCallback) => {
        electronCallback(new Error('there was a problem'))
      }
    }
  })
  // normal properties
  await expect(plugin.imsLogin(gIms, gConfig)).rejects.toEqual(new Error('there was a problem'))

  // error login, result undefined
  Electron.mockImplementation(() => {
    return {
      launch: (electronCallback) => {
        electronCallback()
      }
    }
  })
  // normal properties
  await expect(plugin.imsLogin(gIms, gConfig)).rejects.toEqual(new Error('No result received from web app'))

  // config missing a property
  const configMissingProperties = Object.assign({}, gConfig)
  delete configMissingProperties.client_id
  await expect(plugin.imsLogin(gIms, configMissingProperties)).rejects.toEqual(new Error('OAuth2 not supported due to some missing properties: client_id'))
})
