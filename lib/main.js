const { app, BrowserWindow } = require('electron');
const url = require('url');
const querystring = require('querystring');

if (app.dock) {
    app.dock.hide();
}

function _parseQuery(urlString) {
    return querystring.parse(url.parse(urlString).query);
}

function _failApp(message, state) {
    process.stderr.write(JSON.stringify({ message, state }));
    app.exit(1);
}

function _succeedApp(code, state) {
    process.stdout.write(JSON.stringify({ code, state }));
    app.exit(0);
}

function getArg(argv, idx, message) {
    if (argv.length > idx) {
        return argv[idx];
    }

    _failApp(message);
}

let authUrl = getArg(process.argv, 2, "Missing authentication URL");
let callbackUrl = getArg(process.argv, 3, "Missing callback URL");

function handleCallback(redirectUrl) {
    if (!redirectUrl.startsWith(callbackUrl)) {
        return;
    }

    // dereference window to prevent on close handler trying to terminate
    win = null;

    // If there is a code, proceed to get token from github
    const query = _parseQuery(redirectUrl);
    if (query.code) {
        _succeedApp(query.code, query.state);
    } else if (query.error) {
        _failApp(query.error, query.state);
    } else {
        _failApp(`Unexpected Callback received: ${redirectUrl}`, query.state);
    }
}

let win;

function createWindow() {
    win = new BrowserWindow({
        width: 800,
        height: 600,
        show: false,
        webPreferences: {
            nodeIntegration: false
        }
    })

    win.once('ready-to-show', () => win.show());

    win.webContents.on('did-fail-load',
        (event, errorCode, errorDescription, url) => {
            // dereference window to prevent on close handler trying to terminate
            win = null;

            _failApp(`Failed to load ${url}\nReason: ${errorDescription} (${errorCode})`, _parseQuery(url).state);
        }
    );

    win.webContents.on('will-navigate',
        (event, url) => handleCallback(url)
    );

    win.webContents.on('will-redirect',
        (event, url) => handleCallback(url)
    );

    win.webContents.on('did-get-redirect-request',
        (event, oldUrl, newUrl) => handleCallback(newUrl)
    );

    win.on('closed', () => {
        // only fail the application if the windows has not been
        // closed due to redirect URL received
        if (win) {
            _failApp("User terminated the browser without authenticating", _parseQuery(authUrl).state);
        }
    })

    // load the URL after registering event handler
    win.loadURL(authUrl);
}

app.on('ready', createWindow)
