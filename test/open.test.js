/*
Copyright 2023 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/

// Create a mock function that will replace the real 'open' package
const mockOpenFn = jest.fn().mockResolvedValue(undefined)

// Mock the 'open' package using unstable_mockModule for ESM support
jest.unstable_mockModule('open', () => ({
  default: mockOpenFn
}))

const openModule = require('../src/open')

beforeEach(() => {
  jest.clearAllMocks()
})

test('open function calls the imported open module with correct arguments', async () => {
  const url = 'https://example.com'
  const options = { app: { name: 'firefox' } }

  await openModule(url, options)

  expect(mockOpenFn).toHaveBeenCalledWith(url, options)
  expect(mockOpenFn).toHaveBeenCalledTimes(1)
})

test('open function works without options', async () => {
  const url = 'https://example.com'

  await openModule(url)

  expect(mockOpenFn).toHaveBeenCalledWith(url, undefined)
  expect(mockOpenFn).toHaveBeenCalledTimes(1)
})

test('open function returns the result from the open module', async () => {
  const expectedResult = { childProcess: 'mock' }
  mockOpenFn.mockResolvedValueOnce(expectedResult)

  const result = await openModule('https://example.com', {})

  expect(result).toBe(expectedResult)
})

test('open function propagates errors from the open module', async () => {
  const error = new Error('Failed to open browser')
  mockOpenFn.mockRejectedValueOnce(error)

  await expect(openModule('https://example.com', {})).rejects.toThrow('Failed to open browser')
})
