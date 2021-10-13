# Setup Libindy for MacOS

> NOTE: If these steps do not work, or you want to do a manual install, refer to [here](https://github.com/hyperledger/indy-sdk#ios)

To see if Libindy is already installed, execute the following command:

> A better test would be to clone the [indy-sdk](https://github.com/hyperledger/indy-sdk/) and run:
>
> ```
> cd indy-cli
> cargo build --release
> cd ./target/release/
> ./indy-cli
> wallet create 123 key
> ```

```bash
ls /usr/local/lib/libindy.dylib
# ✅ /usr/local/lib/libindy.dylib
# ❌ ls: /usr/local/lib/libindy.dylib : No such file or directory
```

## MacOS

It is now possible to install libindy and all its dependencies with homebrew!

<p align="center">⚠️ This does not currenlty work on the Macbooks with Apple silicon ⚠️</p>

```bash
brew tap blu3beri/homebrew-libindy
brew install libindy

# If any issues occur that indynode.nodejs could not find libindy or libsodium
mv /usr/local/opt/libsodium/lib/libsodium.dylib /usr/local/opt/libsodium/lib/libsodium.18.dylib
mv /usr/local/Cellar/libindy/1.16.0.reinstall/lib/libindy.dylib /usr/local/lib/
```

If this does not work, you could also use the old steps to install libindy.

1. Download libindy for macOS from the [Sovrin binary repo](https://repo.sovrin.org/macos/libindy/stable/1.16.0/)
2. Extract the ZIP and execute the following commands in the unzipped directory:

```bash
sudo mv lib/* /usr/local/lib

brew install rbenv/tap/openssl@1.0 zeromq libsodium

ln -sfn /usr/local/Cellar/openssl@1.0/1.0.2t /usr/local/opt/openssl
```

3. You now have libindy installed for macOS. You can continue with the [NodeJS Setup](./../setup-nodejs.md)

### Apple Silicon

Homebrew for Apple silicon does not use the `/usr/local/lib` anymore. This means that when `node-gyp` is looking for `/usr/local/lib/libindy.dylib`, it can not find it. There is currently a draft pr open [here](https://github.com/hyperledger/indy-sdk/pull/2428) to fix this.
