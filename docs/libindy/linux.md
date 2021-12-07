# Setup libindy for Linux

> NOTE: If these steps do not work, or you want to do a manual install, refer to [here](https://github.com/hyperledger/indy-sdk#ubuntu-based-distributions-ubuntu-1604-and-1804)

## prerequisites

- A system package manager (like apt, pacman, etc.)
- Node (We have tested 17.0.1 and 16.8.0 and they both work, so those should be safe.)
- Cargo (We have to build libindy from source)
- git (to clone a repo, could also be done with downloading the zip from the github page)

## Step 1: installing the dependencies

This step is platform-dependent so check which distribution you have and use the correct provided script. This script installs libsodium, zeromq and possibly some other minor dependencies. If there is no script provided, check the names of these packages and install them with your package manager.

### Arch based (Arch, Manjaro, Arco, etc.)

```sh
sudo pacman -S libsodium zeromq
```

### Debian based (Ubuntu, Mint, Kali, Deepin, etc.)

```sh
sudo apt install libzmq3-dev libsodium-dev libssl-dev
```

### REHL based (Fedora, CentOS, etc.)

> NOTE: This has not been tested yet. It is based on the previous distributions and might contain mistakes. If you found any please open an issue [here](https://github.com/hyperledger/aries-framework-javascript/issues).

```sh
yum -i libsodium zeromq zeromq-devel
```

## Step 2: Installing libindy

Installing libindy is slightly different from how we installed the dependencies. libindy is technically downloadable with most package managers, however it did not work for me after many attempts. The following method has been tested extensively, and should work on any system with `Cargo` and `git`.

### Step 2.1: Cloning the indy-sdk

```sh
git clone https://github.com/hyperledger/indy-sdk.git

cd indy-sdk/libindy
```

### Step 2.2: Building libindy

If this step throws any errors, it might be because you miss some packages. Step 1 of this guide provided the dependencies that are required, but it also assumed that you have some basic development packages, such as `base-devel` on arch.

```sh
pwd

# OUTPUT: .../indy-sdk/libindy

cargo build --release
```

### Step 2.3: moving the file

```sh
pwd

# OUTPUT: .../indy-sdk/libindy

sudo mv ./target/release/libindy.so /usr/local/lib/libindy.so
```

## Step 3: Confirming the installation

After cloning, building and moving libindy, everything should be installed correctly to develop with Aries Framework JavaScript. To confirm this, execute the following script:

```sh
npx -p @aries-framework/node is-indy-installed

# OUTPUT: Libindy was installed correctly
```

If the output was anything else then that, there might be some issues with your installation. If the only step you did the step 1 and 2 from this article, please report this [here](https://github.com/hyperledger/aries-framework-javascript/issues) with an error log.

To acquire this error log execute the following:

```sh
npm i @aries-framework/node
```
