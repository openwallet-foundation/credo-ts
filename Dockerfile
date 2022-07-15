FROM ubuntu:18.04 as base

ENV DEBIAN_FRONTEND noninteractive

RUN apt-get update -y && apt-get install -y \
    software-properties-common \
    apt-transport-https \
    curl \
    # Only needed to build indy-sdk
    build-essential \
    git \
    libzmq3-dev libsodium-dev pkg-config libssl-dev

# libindy
RUN apt-key adv --keyserver keyserver.ubuntu.com --recv-keys CE7709D068DB5E88
RUN add-apt-repository "deb https://repo.sovrin.org/sdk/deb bionic stable"

# nodejs 16x LTS Debian
RUN curl -fsSL https://deb.nodesource.com/setup_16.x | bash -

# yarn
RUN curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add - && \
    echo "deb https://dl.yarnpkg.com/debian/ stable main" | tee /etc/apt/sources.list.d/yarn.list

# install depdencies
RUN apt-get update -y && apt-get install -y --allow-unauthenticated \
    libindy \
    nodejs

# Install yarn seperately due to `no-install-recommends` to skip nodejs install 
RUN apt-get install -y --no-install-recommends yarn

# postgres plugin setup
# install rust and set up rustup
RUN curl https://sh.rustup.rs -sSf | bash -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"

# clone indy-sdk and build postgres plugin
RUN git clone https://github.com/hyperledger/indy-sdk.git
WORKDIR /indy-sdk/experimental/plugins/postgres_storage/
RUN cargo build --release

# set up library path for postgres plugin
ENV LIB_INDY_STRG_POSTGRES="/indy-sdk/experimental/plugins/postgres_storage/target/release"

FROM base as final

# AFJ specifc setup
WORKDIR /www
ENV RUN_MODE="docker"

# Copy dependencies
COPY . . 

RUN yarn install
RUN yarn build