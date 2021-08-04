/*
Copyright 2021 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0
Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/

const { ErrorWrapper, createUpdater } = require('@adobe/aio-lib-core-errors').AioCoreSDKErrorWrapper

const codes = {}
const messages = new Map()

/**
 * Create an Updater for the Error wrapper
 */
const Updater = createUpdater(
  // object that stores the error classes (to be exported)
  codes,
  // Map that stores the error strings (to be exported)
  messages
)

/**
 * Provides a wrapper to easily create classes of a certain name, and values
 */
const E = ErrorWrapper(
  // The class name for your SDK Error. Your Error objects will be these objects
  'IMSOAuthLibError',
  // The name of your SDK. This will be a property in your Error objects
  'IMSOAuthSDK',
  // the object returned from the CreateUpdater call above
  Updater
  // the base class that your Error class is extending. AioCoreSDKError is the default
  /* , AioCoreSDKError */
)

module.exports = {
  codes,
  messages
}

// Define your error codes with the wrapper
E('HTTP_ERROR', 'error code=%s')
E('MISSING_PROPERTIES', 'OAuth2 not supported due to some missing properties: %s')
E('TIMEOUT', 'Timed out after %s seconds.')
