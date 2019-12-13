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

const Electron = require('../src/electron')
const childProcess = require('child_process')

jest.mock('child_process')

beforeAll(() => {
  jest.useRealTimers()
})

afterAll(() => {
  jest.useFakeTimers()
})

beforeEach(() => {
  jest.restoreAllMocks()
})

test('launch - success', () => {
  const result = { code: 'my-code', state: 'my-state' }
  const exitCallback = (code, state) => {
    expect(code).toEqual(result.code)
    expect(state).toEqual(result.state)
  }

  childProcess.execFile.mockImplementation((electronPath, args, callback) => {
    callback(null, JSON.stringify(result))
  })

  const electron = new Electron('my-app-url', 'my-callback-url', true)
  expect(electron.launch(exitCallback)).toEqual(electron)
})

test('launch - error', () => {
  const error = { message: 'my-message', state: 'my-state' }
  const exitCallback = (err, state) => {
    expect(err).toEqual(new Error(error.message))
    expect(state).toEqual(error.state)
  }

  childProcess.execFile.mockImplementation((electronPath, args, callback) => {
    callback(new Error(), null, JSON.stringify(error))
  })

  const electron = new Electron('my-app-url', 'my-callback-url', true)
  expect(electron.launch(exitCallback)).toEqual(electron)
})

test('terminate', () => {
  childProcess.execFile.mockImplementation((electronPath, args, callback) => {
    return {
      kill: jest.fn()
    }
  })

  const electron = new Electron('my-app-url', 'my-callback-url', true)

  // coverage: terminate without being launched first
  expect(electron.terminate()).toEqual(electron)

  // coverage: terminate after being launched
  expect(electron.launch(() => true)).toEqual(electron)
  expect(electron.terminate()).toEqual(electron)
})
