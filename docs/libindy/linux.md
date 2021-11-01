# Setup Libindy for Linux

> NOTE: If these steps do not work, or you want to do a manual install, refer to [here](https://github.com/hyperledger/indy-sdk#ubuntu-based-distributions-ubuntu-1604-and-1804)

To see if Libindy is correctly installed for javascript usage, execute the following command:

```ts
npx -p @aries-framework/node is-indy-installed

# output
# Libindy was installed correctly
```

The easiest way to install libindy for all linux platforms is by building libindy yourself. For Ubuntu based distributions you can also follow the install guide in the [Indy SDK docs](https://github.com/hyperledger/indy-sdk#ubuntu-based-distributions-ubuntu-1604-and-1804)

## Manual: Arch based distributions

Install for Arch based distributions such as Manjaro, Arch, Arco, etc.

```bash
# Install dependencies
sudo pacman -S libsodium zermomq rust

# Clone the indy-sdk
git clone https://github.com/hyperledger/indy-sdk.git

# Go to indy-sdk/libindy folder
cd indy-sdk/libindy

# Build libindy
cargo build --release

# Move the binary to the library folder
sudo mv target/release/libindy.so /usr/lib/
```

You now have libindy installed for Arch. You can continue with the [NodeJS Setup](./../setup-nodejs.md)

## Manual: Debian based distributions

Install for Debian based distributions such as Ubuntu, Linux Minut, POP_OS, etc.

```bash
# Install dependencies
sudo apt install libzmq3-dev libsodium-dev libssl-dev pkg-config cargo

# Clone the indy-sdk
git clone https://github.com/hyperledger/indy-sdk.git

# Go to indy-sdk/libindy folder
cd indy-sdk/libindy

# Build libindy
cargo build --release

# Move the binary to the library folder
sudo mv target/release/libindy.so /usr/lib/
```

You now have libindy installed for Debian. You can continue with the [NodeJS Setup](./../setup-nodejs.md)

## Resources

- [Indy SDK docs](https://github.com/hyperledger/indy-sdk#ubuntu-based-distributions-ubuntu-1604-and-1804)
