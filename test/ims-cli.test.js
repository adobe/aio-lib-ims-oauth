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

const plugin = require('../src/ims-cli')
const login = require('../src/login')

jest.mock('../src/login')

const gIms = {
  getAccessToken: jest.fn()
}

const gConfig = {
  'cli.bare-output': true
}

beforeEach(() => {
  jest.clearAllMocks()
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

  login.mockImplementation((config) => {
    return myAccessToken
  })

  // normal acceptable config
  await expect(plugin.imsLogin(gIms, gConfig)).resolves.toEqual(myAccessToken)

  // config missing a property
  const configMissingProperties = Object.assign({}, gConfig)
  delete configMissingProperties['cli.bare-output']
  await expect(plugin.imsLogin(gIms, configMissingProperties)).rejects.toThrow(
    '[IMSOAuthSDK:MISSING_PROPERTIES] OAuth2 not supported due to some missing properties: cli.bare-output')
})
