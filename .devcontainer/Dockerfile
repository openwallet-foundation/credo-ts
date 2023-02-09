FROM ubuntu:21.10

ENV TZ=UTC
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && \
    echo $TZ > /etc/timezone

RUN apt-get update && \
    apt-get install -y tzdata curl gnupg git \
    software-properties-common iproute2

RUN apt-get install -y \
    build-essential \
    pkg-config \
    cmake \
    libssl-dev \
    libsqlite3-dev \
    libzmq3-dev \
    libncursesw5-dev

RUN curl -Ls https://download.libsodium.org/libsodium/releases/libsodium-1.0.18.tar.gz | \
    tar -zx -C / && \
    cd /libsodium-1.0.18 && \
    ./configure --disable-sharedmake && \
    make && \
    make check && \
    make install && \
    cd - && \
    rm -rf /libsodium-1.0.18

RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y

RUN git clone https://github.com/hyperledger/indy-sdk.git && \
    cd ./indy-sdk/libindy && \
    /root/.cargo/bin/cargo build && \
    echo "export LD_LIBRARY_PATH=$LD_LIBRARY_PATH:/indy-sdk/libindy/target/debug" >> ~/.bashrc && \
    ldconfig && \
    . ~/.bashrc

RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.38.0/install.sh | bash && \
    . ~/.bashrc && \
    nvm install v12.22.1 && \
    nvm install-latest-npm && \
    npm install --global yarn
