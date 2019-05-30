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

const http = require('http');
const https = require('https');
const fs = require('fs');
const net = require('net');
const url = require('url');
const { execFileSync } = require('child_process');
const debug = require('debug')('@adobe/aio-cli-plugin-ims-oauth/proxy');

function sendStatus(response, status, message) {
  response.writeHead(status, {
    'Content-Length': Buffer.byteLength(message),
    'Content-Type': 'text/plain'
  });
  response.end(message);
}

class ProxyServer {

  constructor(callbackUrl, dataCallback) {

    this.cert = {
      key: `/tmp/server.${process.pid}.key`,
      cert: `/tmp/server.${process.pid}.cert`
    }

    // openssl req -nodes -new -x509 -keyout server.key -out server.cert -days 1 -subj '/CN=localhost'
    try {
      this.childProcess = execFileSync("openssl",
        [
          'req',
          '-nodes',
          '-new',
          '-x509',
          '-keyout', this.cert.key,
          '-out', this.cert.cert,
          '-days', '1',
          '-subj', '/CN=localhost'
        ],
        {
          stdio: 'ignore'
        });
    } catch (err) {
      throw new Error("Cannot create temporary certificate. Is OpenSSL installed and on the path ?");
    }

    const httpsOptions = {
      key: fs.readFileSync(this.cert.key),
      cert: fs.readFileSync(this.cert.cert)
    }

    this.httpsServer = https.createServer(httpsOptions, this._onRequest);

    // capture the proxy server instance inside the HTTPS Server object
    // callbacks to get to it with "this.proxyServer...."
    this.httpsServer.proxyServer = this;

    // configure the catch-all callback URL which should be handled
    // by the server itself. That is, CONNECT will connect the server
    // itself for this callbackUrl
    let cbUrl = url.parse(callbackUrl);
    this.connectstring = `${cbUrl.hostname}:${cbUrl.port ? cbUrl.port : cbUrl.protocol === 'http:' ? 80 : 443}`;
    this.httpsServer.on('connect', this._onConnect)

    // gracefully handle a client side error
    this.httpsServer.on('clientError', this._onClientError);

    this.httpsServer.on('error', (err) => {
      console.log("BAMM: I got an error: " + err)
    });

    this.dataCallback = dataCallback;

    debug("ProxyServer: connectstring: %s", this.connectstring);
  }

  async listen() {
    return new Promise((resolve, reject) => {
      this.httpsServer.listen(0, 'localhost', () => {
        const adr = this.httpsServer.address();
        this.proxyUrl = `https://${adr.address}:${adr.port}`;
        debug("Server ready on %s", this.proxyUrl);
        resolve(this.proxyUrl);
      });
    });
  }

  terminate() {
    // stop the server
    if (this.httpsServer) {
      this.httpsServer.close(() => { debug("HTTPS Server/Proxy terminated.") });
      this.httpsServer = undefined;
    }

    // remove the certificates
    if (fs.existsSync(this.cert.key)) {
      fs.unlinkSync(this.cert.key);
    }
    if (fs.existsSync(this.cert.cert)) {
      fs.unlinkSync(this.cert.cert);
    }
  }

  // returns true if the hostPort matches the callbackUrl's authority
  _isCallback(hostPort, isSecure) {
    if (hostPort.indexOf(':') < 0) {
      hostPort += ':' + (isSecure ? 443 : 80);
    }
    debug("%s === %s", this.connectstring, hostPort);
    return this.connectstring === hostPort;
  }

  // Client side error handling
  _onClientError(err, socket) {
    debug("Client caused an error: %o", err);
    socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
  }

  // HTTPS Proxy Function
  _onConnect(request, cltSocket, head) {
    debug("_onConnect: %s / %s", request.url, this.proxyServer.connectstring);
    let [host, port] = (request.url === this.proxyServer.connectstring)
      ? [this.address().address, this.address().port]
      : request.url.split(":", 2);

    debug("CONNECT %s:%d", host, port);
    const srvSocket = net.connect(port, host, doTunnel);

    srvSocket.on('error', err => debug("Socket Error: %o (Logging only)", err));
    cltSocket.on('error', err => debug("Socket Error: %o (Logging only)", err));

    function doTunnel() {
      try {
        cltSocket.write('HTTP/1.1 200 Connection Established\r\n' +
          'Proxy-agent: Node.js-Proxy\r\n' +
          '\r\n');
        srvSocket.write(head);
        srvSocket.pipe(cltSocket).pipe(srvSocket);
      } catch (err) {
        debug("Some error occurred while tunneling: %s", err.message)
      }
    }
  }

  // normal request handler as well proxying plain HTTP
  _onRequest(request, response) {
    const host = request.headers['host'];
    if (this.proxyServer._isCallback(host, true)) {
      this.proxyServer.dataCallback(request.url);
      sendStatus(response, 200, "Thanks. I got the required code. This window will be closed shortly.");
      return
    }

    // require fully-qualified domains
    if (host !== "localhost" && host.indexOf(".") < 0) {
      debug("Blocking Request to %s", request.url);
      sendStatus(response, 403, 'Forbidden');
      return
    }

    debug("Proxying request to %s", request.url);

    var options = url.parse(request.url)
    options.method = request.method;
    options.headers = request.headers;

    // setup the proxy request to the target
    // where the callback pipes back the origin
    // response to the client response
    var proxy = http.request(options, res => {
      debug("Response from %o: %d", options, res.statusCode);
      response.writeHead(res.statusCode, res.headers)
      res.pipe(response);
    });

    // handle any errors !
    proxy.on('error', (err) => {
      debug("Problem with request: %o", err);
      sendStatus(response, 502, `not operational. ignoring request to ${request.url}`);
    });

    // pipe the request to the proxy request
    // this starts sending data
    request.pipe(proxy);
  }
}

module.exports = ProxyServer;
