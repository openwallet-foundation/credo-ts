# Note that the indy-sdk requires ubuntu 16 and some custom dependencies so we can't use node:carbon-apline like the others
FROM ubuntu:16.04

# Grab dependencies via apt-get
RUN apt-get update && \
      apt-get install -y \
      software-properties-common \
      apt-transport-https \
      curl \
      build-essential \
      python2.7 \
      python-pip

ARG libindy_ver=1.11.0
# Recommended way to get setup with libindy: https://github.com/hyperledger/indy-sdk#ubuntu-based-distributions-ubuntu-1604
ARG indy_stream=stable
RUN apt-key adv --keyserver keyserver.ubuntu.com --recv-keys 68DB5E88 && \
    add-apt-repository "deb https://repo.sovrin.org/sdk/deb xenial $indy_stream" && \
    apt-get update && \
    apt-get install -y libindy=${libindy_ver}

# Setup nodejs --- prob dont need this
RUN curl -sL https://deb.nodesource.com/setup_8.x | bash && \
    apt-get install nodejs -y

# setup yarn
RUN curl -o- -L https://yarnpkg.com/install.sh | bash

# Setup our server
RUN mkdir www/
WORKDIR www/
ADD package.json ./
# RUN yarn install
ADD . .
# @todo need an easy way to switch between dev and prod, can use docker-compose
CMD [ "bash" ]
