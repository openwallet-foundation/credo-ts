# Setup Libindy for MacOS, with an Intel processor

> NOTE: If these steps do not work, or you want to do a manual install, refer to [here](https://github.com/hyperledger/indy-sdk#macos)

## prerequisites

- Homebrew
- Node (We have tested 17.0.1 and 16.8.0 and they both work, so those should be safe.)

## Step 1: Installing Libindy

Since some time it is possible to install libindy for macos via a very simple homebrew script. This script install libindy from the correct repository and installs its dependencies. These dependencies include `OpenSSL`, `ZeroMQ` and `Libsodium`.

```sh
brew tap blu3beri/homebrew-libindy
brew install libindy
```

## Step 2: Confirm the installation

To confirm if libindy is correctly installed to be used with [Aries Framework JavaScript](https://github.com/hyperledger/aries-framework-javascript), run the following command:

```sh
npx -p @aries-framework/node is-indy-installed

# OUTPUT: Libindy was installed correctly
```

If the output was anything else then that, there might be some issues with your installation. If the only step you did the step 1 from this article, please report this [here](https://github.com/hyperledger/aries-framework-javascript/issues) or email me directly at berend@animo.id with an error log.

To acquire this error log execute the following:

```sh
npm i @aries-framework/node
```
