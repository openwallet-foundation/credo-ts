FROM animosolutions/indy-nodejs:1.15.0 as base

WORKDIR /www
ENV RUN_MODE="docker"

COPY package.json package.json
COPY yarn.lock yarn.lock

# Run install after copying only depdendency file
# to make use of docker layer caching
RUN yarn install

# Copy other depdencies
COPY . . 

RUN yarn compile