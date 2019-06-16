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

const electronPath = require('electron');
const { execFile } = require('child_process');

class Electron {
    constructor(appUrl, callbackUrl) {
        this.appUrl = appUrl;
        this.callbackUrl = callbackUrl;
    }

    launch(exitCallback) {
        const args = [
            `${__dirname}/../lib`,
            this.appUrl,
            this.callbackUrl
        ];

        this.childProcess = execFile(electronPath,
            args,
            (err, stdout, stderr) => {
                if (err) {
                    exitCallback(new Error(stderr));
                } else {
                    exitCallback(stdout);
                }
            }
        );

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

module.exports = Electron;
