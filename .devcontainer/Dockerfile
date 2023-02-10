# arm + amd compatible Dockerfile
FROM ghcr.io/findy-network/findy-base:indy-1.16.ubuntu-18.04 AS indy-base

FROM ubuntu:18.04

# install indy deps and files from base
RUN apt-get update && apt-get install -y libsodium23 libssl1.1 libzmq5 git zsh

COPY --from=indy-base /usr/include/indy /usr/include/indy
COPY --from=indy-base /usr/lib/libindy.a /usr/lib/libindy.a
COPY --from=indy-base /usr/lib/libindy.so /usr/lib/libindy.so

RUN apt-get install -y curl python3 build-essential ca-certificates && \
  curl https://raw.githubusercontent.com/creationix/nvm/master/install.sh | bash && \
  export NVM_DIR="$HOME/.nvm" && \
  [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" && \
  nvm install v16 && \
  npm install yarn -g

RUN sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"
