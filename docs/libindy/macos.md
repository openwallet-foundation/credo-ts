# Setup Libindy for MacOS

> NOTE: If these steps do not work, or you want to do a manual install, refer to [here](https://github.com/hyperledger/indy-sdk#ios)

To see if Libindy is already installed, execute the following command:

```bash
ls /usr/local/lib/libindy.dylib
# ✅ /usr/local/lib/libindy.dylib
# ❌ ls: /usr/local/lib/libindy.dylib : No such file or directory
```

## MacOS

1. Download libindy for macOS from the [Sovrin binary repo](https://repo.sovrin.org/macos/libindy/stable/1.16.0/)
2. Extract the ZIP and execute the following commands in the unzipped directory:

```bash
sudo mv lib/* /usr/local/lib

brew install rbenv/tap/openssl@1.0 zeromq libsodium

ln -sfn /usr/local/Cellar/openssl@1.0/1.0.2t /usr/local/opt/openssl
```

3. You now have libindy installed for macOS. You can continue with the [NodeJS Setup](./../setup-nodejs.md)
