```sh
curl -v https://ims-na1-stg1.adobelogin.com/ims/authorize/
?
response_type=code&
state=&
client_id=fmeschbe_test&
scope=openid%20AdobeID%20additional_info.projectedProductContext%20read_organizations&
redirect_uri=https%3A%2F%2Fpostman.meschberger.ch
```

chrome --proxy-server=https://secure-proxy.example.com:443

{
  "callback_url": "https://postman.meschberger.ch",
  "auth_url": "https://ims-na1-stg1.adobelogin.com/ims/authorize/",
  "access_token_url": "https://ims-na1-stg1.adobelogin.com/ims/token/",
  "client_id": "fmeschbe_test",
  "client_secret": "d2dedd23-4f1c-4509-9068-4ab73e413aa1",
  "scope": "openid AdobeID additional_info.projectedProductContext read_organizations",
  "state": ""
}

https://peter.sh/experiments/chromium-command-line-switches/

Source:

```js
const chromium = require('chromium');
const {execFile} = require('child_process');

execFile(chromium.path, ['https://google.com'], err => {
	console.log('Hello Google!');
});
```

## Refresh an expired access token

When an access token expires, send the refresh token (if you have one) in a POST request for a new access token from the /ims/token/ endpoint. Add the following parameters to the body of the POST request:

| Parameters |  |
|------------|-----|
| grant_type | The constant value `refresh_token`.
| refresh_token | The base-64 encoded refresh token received in the response to the initial request for an access token.
| client_id | Your IMS client ID, assigned on registration.
| client_secret | Your IMS client-secret credential, assigned on registration.
| scope | Optional. Default is the scope list in the refresh token. If supplied, must be a subset of the scopes in the refresh token.<br/>The success and error responses are the same as those for the initial authorization-code token request. The success response contains a new access token, and returns the same refresh token. |

For clients that have defined an SSO relationship (such as: ClientA accepts SSO from ClientB and ClientC) with the sso_buddies client config, any of the clients can refresh the access token if they share the refresh tokens.