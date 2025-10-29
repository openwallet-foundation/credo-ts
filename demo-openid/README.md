<h1 align="center"><b>DEMO</b></h1>

This is the Credo OpenID4VC demo. Walk through the Credo flow yourself together with agents Alice and Faber.

Alice, a former student of Faber College, connects with the College, is issued a credential about her degree and then is asked by the College for a proof.

## Features

- ✅ Issuing a credential without authorization (pre-authorized code flow).
- ✅ Issuing a credential with external authorization server (authorization code flow)
- ✅ Resolving a credential offer.
- ✅ Accepting a credential offer.
- ✅ Requesting a credential presentation.
- ✅ Resolving a presentation request.
- ✅ Accepting a resolved presentation request.

## Getting Started

### Platform Specific Setup

In order to run the Credo demo, you need to make sure you have Node.JS and PNPM installed. See the [Credo Prerequisites](https://credo.js.org/guides/getting-started/prerequisites) for more information.

### Run the demo

These are the steps for running the Credo OpenID4VC demo:

Clone the Credo git repository:

```sh
git clone https://github.com/openwallet-foundation/credo-ts.git
```

Open four different terminals next to each other and in each, go to the demo folder:

```sh
cd credo-ts/demo-openid
```

Install the project in one of the terminals:

```sh
pnpm install
```

In the first terminal run the OpenID Provider:

```sh
pnpm provider
```

In the second terminal run the Issuer:

```sh
pnpm issuer
```

In the third terminal run the Holder:

```sh
pnpm holder
```

In the last terminal run the Verifier:

```sh
pnpm verifier
```

### Usage

To create a credential offer:

- Go to the Issuer terminal.
- Select `Create a credential offer`.
- Choose whether authorization is required
- Select the credential(s) you want to issue.
- Now copy the content INSIDE the quotes (without the quotes).

To resolve and accept the credential:

- Go to the Holder terminal.
- Select `Resolve a credential offer`.
- Paste the content copied from the credential offer and hit enter.
- Select `Accept the credential offer`.
- Choose which credential(s) to accept
- If authorization is required a link will be printed in the terminal, open this in your browser. You can sign in using any username and password. Once authenticated return to the terminal
- You have now stored your credential.

To create a presentation request:

- Go to the Verifier terminal.
- Select `Request the presentation of a credential`.
- Select `UniversityDegreeCredential`.
- Copy the presentation request string content, without the quotes.

To resolve and accept the presentation request:

- Go to the Holder terminal.
- Select `Resolve a proof request`.
- Paste the copied string (without the quotes).
- Hit enter: You should see a Green message saying what will be presented.
- Select `Accept presentation request`.
- The presentation should be sent (WIP).

Exit:

- Select 'exit' to shutdown the program.

Restart:

- Select 'restart', to shutdown the current program and start a new one

### Optional Proxy

By default all services will be started on `localhost`, and thus won't be reachable by other external services (such as a mobile wallet). If you want to expose the required services to the public, you need to expose multiple ngrok tunnels.

We can setup the tunnels automatically using ngrok. First make sure you have an ngrok account and get your access token from this page: https://dashboard.ngrok.com/get-started/setup/

Then copy the `ngrok.auth.example.yml` file to `ngrok.auth.yml`:

```sh
cp ngrok.auth.example.yml ngrok.auth.yml
```

And finally set the `authtoken` to the auth token as displayed in the ngrok dashboard.

Once set up, you can run the following command in a separate terminal window.

```sh
pnpm proxies
```

This will open three proxies. You should then run your demo environments with these proxies:

- `PROVIDER_HOST=https://d404-123-123-123-123.ngrok-free.app ISSUER_HOST=https://d738-123-123-123-123.ngrok-free.app pnpm provider` (ngrok url for port 3042)
- `PROVIDER_HOST=https://d404-123-123-123-123.ngrok-free.app ISSUER_HOST=https://d738-123-123-123-123.ngrok-free.app pnpm issuer` (ngrok url for port 2000)
- `VERIFIER_HOST=https://1d91-123-123-123-123.ngrok-free.app pnpm verifier` (ngrok url for port 4000)

### Optional Google Account API for Chained Identity

You can also configure external identity providers in order to be able to use their access tokens to fetch specific data for credentials. In this demo, we have an integration with Google Account OpenID Connect API, which provides an ID Token with information we then use to put on the credential itself.

To set this up, you need to create an account in [Google Cloud](https://console.cloud.google.com/auth/overview) platform, and configure a client with the correct domain. In this case, you need a proxy since the URL is not allowed to be `localhost`.

In addition, the following scopes are necessary:

- `openid`
- `https://www.googleapis.com/auth/userinfo.email`

Once you have the client ID and client secret from the Google integration, please start the issuer as follows:

```sh
ISSUER_HOST="<issuer-host>" GOOGLE_CLIENT_ID="<google-client-id>" GOOGLE_CLIENT_SECRET="<google-client-secret>"  pnpm issuer
```
