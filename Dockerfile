## Stage 1: Build indy-sdk and postgres plugin

FROM ubuntu:22.04 as base

# Set this value only during build
ARG DEBIAN_FRONTEND noninteractive

# Define packages to install
ENV PACKAGES software-properties-common ca-certificates \
    curl build-essential git \
    libzmq3-dev libsodium-dev pkg-config gnupg

# Combined update and install to ensure Docker caching works correctly
RUN apt-get update -y \
    && apt-get install -y $PACKAGES

RUN curl http://security.ubuntu.com/ubuntu/pool/main/o/openssl/libssl1.1_1.1.1-1ubuntu2.1~18.04.23_amd64.deb -o libssl1.1.deb \
    # libssl1.1 (required by libindy)
    && dpkg -i libssl1.1.deb \
    && curl http://security.ubuntu.com/ubuntu/pool/main/o/openssl/libssl-dev_1.1.1-1ubuntu2.1~18.04.23_amd64.deb -o libssl-dev1.1.deb \
    # libssl-dev1.1 (required to compile libindy with posgres plugin)
    && dpkg -i libssl-dev1.1.deb

# Add APT sources
RUN apt-key adv --keyserver keyserver.ubuntu.com --recv-keys CE7709D068DB5E88 \
    && add-apt-repository "deb https://repo.sovrin.org/sdk/deb bionic stable" \
    && mkdir -p /etc/apt/keyrings \
    && curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg \
    && echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_18.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list  \
    && curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add - \
    && echo "deb https://dl.yarnpkg.com/debian/ stable main" | tee /etc/apt/sources.list.d/yarn.list

# Install libindy, NodeJS and yarn
RUN apt-get update -y \
    # Install libindy
    && apt-get install -y --allow-unauthenticated libindy \
    && apt-get install -y nodejs \
    && apt-get install -y --no-install-recommends yarn \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean -y

# postgres plugin setup
# install rust and set up rustup
RUN curl https://sh.rustup.rs -sSf | bash -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"

# cargo build failing on latest release of rust due to socket2 dependency in the plugin https://users.rust-lang.org/t/build-broken-with-parse-quote-spanned-is-ambiguous/80280/2 so pointing rust version to 1.63.0
RUN rustup default 1.63.0

# clone indy-sdk and build postgres plugin
RUN git clone https://github.com/hyperledger/indy-sdk.git
WORKDIR /indy-sdk/experimental/plugins/postgres_storage/
RUN cargo build --release

# set up library path for postgres plugin
ENV LIB_INDY_STRG_POSTGRES="/indy-sdk/experimental/plugins/postgres_storage/target/release"

## Stage 2: Build Aries Framework JavaScript

FROM base as final

# Set environment variables
ENV RUN_MODE="docker"

# Set working directory
WORKDIR /www

# Copy repository files
COPY . . 

# Run yarn install and build
RUN yarn install --frozen-lockfile \
    && yarn build
