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

const chromium = require('chromium');
const { execFile } = require('child_process');

class Browser {
  constructor(appUrl, proxyUrl) {
    this.appUrl = appUrl;
    this.proxyUrl = proxyUrl;
  }

  launch(incognito, userExitCallback) {
    const args = [
      '--allow-insecure-localhost',
      '--ignore-certificate-errors',
      '--window-size=800,600'
    ];

    if (this.appUrl) {
      args.push(`--app=${this.appUrl}`)
    }
    if (this.proxyUrl) {
      args.push(`--proxy-server=${this.proxyUrl}`)
    }
    if (incognito) {
      args.push('--incognito');
    }

    this.childProcess = execFile(chromium.path,
      args,
      err => {
        if (err) {
          console.error('An error occurred trying to launch browser: ' + err.message)
          console.debug(err.stack)
        }
      }
    );

    this.childProcess.on('exit', () => {
      if (userExitCallback) {
        userExitCallback();
      }
    });

    return this;
  }

  terminate() {
    if (this.childProcess) {
      this.childProcess.kill();
      this.childProcess = undefined;
    }

    return this;
  }
}

module.exports = Browser;
