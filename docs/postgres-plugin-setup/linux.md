# Setup libindy postgres plugin for Linux

## prerequisites

- A system package manager (like apt, pacman, etc.)
- Cargo (We have to build postgres plugin from source)
- git (to clone a repo, could also be done with downloading the zip from the github page)

## Step 1: installing the dependencies using apt

### Debian based (Ubuntu, Mint, Kali, Deepin, etc.)

```sh
sudo apt install libzmq3-dev libsodium-dev libssl-dev
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

sudo mv ./target/release/libindystrgpostgres.so /usr/local/lib/libindystrgpostgres.so
```
