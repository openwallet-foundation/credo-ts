# Setup postgres plugin for MacOS

> Note: We have tried to build on both intel and apple silicon.

## prerequisites

- Homebrew
- Cargo (We have to build postgres plugin from source)
- git (to clone a repo, could also be done with downloading the zip from the github page)

## Step 1: installing the dependencies using brew

```sh
brew install libsodium zeromq
```

## Step 2: Build postgres plugin

Building postgres plugin from the indy sdk repo with cargo.

### Step 2.1: Cloning the indy-sdk

```sh
git clone https://github.com/hyperledger/indy-sdk.git

cd indy-sdk/experimental/plugins/postgres_storage
```

### Step 2.2: Building postgres plugin

If this step throws any errors, it might be because you miss some packages. Step 1 of this guide provided the dependencies that are required, but it also assumed that you have some basic development packages installed. If you are missing some packages, you can install them with your package manager.

```sh
pwd

# OUTPUT: .../indy-sdk/experimental/plugins/postgres_storage

cargo build --release
```

### Step 2.3: Moving the file

```sh
pwd

# OUTPUT: .../indy-sdk/experimental/plugins/postgres_storage

sudo mv ./target/release/libindystrgpostgres.dylib /usr/local/lib/libindystrgpostgres.dylib
```
