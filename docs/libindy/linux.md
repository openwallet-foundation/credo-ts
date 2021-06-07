# Setup Libindy for Linux

To see if Libindy is already installed, execute the following command:

```bash
ls /usr/lib/libindy.so
# ✅ /usr/lib/libindy.so
# ❌ ls: /usr/lib/libindy.so: No such file or directory
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
