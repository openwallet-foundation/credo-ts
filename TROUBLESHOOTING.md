# Troubleshooting

This document contains the most common errors that arise when first installing libindy and Aries Framework JavaScript. If you encounter a problem that is not listed here and manage to fix it, please open a PR describing the steps taken to resolve the issue.

- [macOS](#macos)
  - [Unable to find `libindy.dylib`](#unable-to-find-libindydylib)
  - [Unable to find `libssl.1.0.0.dylib`](#unable-to-find-libssl100dylib)
  - [Library not loaded: `libsodium.18.dylib`](#library-not-loaded-libsodium18dylib)

## macOS

### Unable to find `libindy.dylib`

Installing Libindy on macOS can be tricky. If the the troubleshooting section of the NodeJS Wrapper documentation doesn't provide an answer and you're getting the following error:

```
dlopen(/<absolute-path>/aries-framework-javascript/node_modules/indy-sdk/build/Release/indynodejs.node, 1): Library not loaded: /Users/jenkins/workspace/indy-sdk_indy-sdk-cd_master/libindy/target/release/deps/libindy.dylib
     Referenced from: /<absolute-path>/aries-framework-javascript/node_modules/indy-sdk/build/Release/indynodejs.node
     Reason: image not found
```

See this StackOverflow answer: https://stackoverflow.com/questions/19776571/error-dlopen-library-not-loaded-reason-image-not-found

The NodeJS Wrapper tries to find the library at the hardcoded CI built path `/Users/jenkins/workspace/indy-sdk_indy-sdk-cd_master/libindy/target/release/deps/libindy.dylib`. However the library will probably be located at `/usr/local/lib/libindy.dylib` (depending on how you installed libindy).

To check where the NodeJS wrapper points to the static CI build path you can run:

```bash
$ otool -L node_modules/indy-sdk/build/Release/indynodejs.node
node_modules/indy-sdk/build/Release/indynodejs.node:
        /Users/jenkins/workspace/indy-sdk_indy-sdk-cd_master/libindy/target/release/deps/libindy.dylib (compatibility version 0.0.0, current version 0.0.0)
        /usr/lib/libc++.1.dylib (compatibility version 1.0.0, current version 902.1.0)
        /usr/lib/libSystem.B.dylib (compatibility version 1.0.0, current version 1281.100.1)
```

You can manually change the path using the `install_name_tool`. Be sure change the path if you're not using the default.

```bash
install_name_tool -change /Users/jenkins/workspace/indy-sdk_indy-sdk-cd_master/libindy/target/release/deps/libindy.dylib /usr/local/lib/libindy.dylib node_modules/indy-sdk/build/Release/indynodejs.node
```

### Unable to find `libssl.1.0.0.dylib`

Libindy makes use of OpenSSL 1.0, however macOS by default has OpenSSL version 1.1. The standard brew repo also doesn't contain version 1.0 anymore. So if you're getting something that looks like the following error:

```
dlopen(/<absolute-path>/aries-framework-javascript/node_modules/indy-sdk/build/Release/indynodejs.node, 1): Library not loaded: /usr/local/opt/openssl/lib/libssl.1.0.0.dylib
      Referenced from: /<absolute-path>/libindy_1.15.0/lib/libindy.dylib
      Reason: image not found
```

You can manually install OpenSSL 1.0 with the following Brew command:

```sh
brew install https://raw.githubusercontent.com/Homebrew/homebrew-core/64555220bfbf4a25598523c2e4d3a232560eaad7/Formula/openssl.rb -f
```

In newer versions of HomeBrew installing packages is disabled, which will give an error that looks something like this:

```
Error: Calling Installation of openssl from a GitHub commit URL is disabled! Use 'brew extract openssl' to stable tap on GitHub instead.
```

They advise to use `brew extract` which also gives errors. The easiest way is to download the file and then extract it:

```sh
curl https://raw.githubusercontent.com/Homebrew/homebrew-core/64555220bfbf4a25598523c2e4d3a232560eaad7/Formula/openssl.rb -o openssl.rb
brew install openssl.rb
```

### Library not loaded: `libsodium.18.dylib`

When you install `libsodium` it automatically installs version 23. However libindy needs version 18. So if you're getting something that looks like the following error:

```
dyld: Library not loaded: /usr/local/opt/libsodium/lib/libsodium.18.dylib
```

You can manually link the path for version 18 to the path of version 23 with the following command:

```sh
ln -s /usr/local/opt/libsodium/lib/libsodium.23.dylib /usr/local/opt/libsodium/lib/libsodium.18.dylib
```

Inspired by [this answer](https://github.com/Homebrew/homebrew-php/issues/4589) to the same error using php71-libsodium.
