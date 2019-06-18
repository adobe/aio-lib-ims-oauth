const { app, BrowserWindow } = require('electron');

if (app.dock) {
    app.dock.hide();
}

function _failApp(message) {
    process.stderr.write(message);
    app.exit(1);
}

function _succeedApp(result) {
    process.stdout.write(result);
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

function handleCallback(url) {
    if (!url.startsWith(callbackUrl)) {
        return;
    }

    // dereference window to prevent on close handler trying to terminate
    win = null;

    var raw_code = /code=([^&]*)/.exec(url) || null;
    var code = (raw_code && raw_code.length > 1) ? raw_code[1] : null;

    var raw_error = /error=([^&]*)/.exec(url) || null;
    var error = (raw_error && raw_error.length > 1) ? raw_error[1] : null;

    // If there is a code, proceed to get token from github
    if (code) {
        _succeedApp(code);
    } else if (error) {
        _failApp(`Cannot login with error: ${error}`);
    }

    // catch all here
    _failApp(`Unexpected Callback received: ${url}`);
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

            _failApp(`Failed to load ${url}\nReason: ${errorDescription} (${errorCode})`)
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
            _failApp("User terminated the browser without authenticating");
        }
    })

    // load the URL after registering event handler
    win.loadURL(authUrl);
}

app.on('ready', createWindow)
