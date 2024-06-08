FROM node:22

# Set working directory
WORKDIR /www

# Copy repository files
COPY . . 

# Run yarn install and build
RUN yarn install --frozen-lockfile \
    && yarn build

entrypoint ["yarn", "run-mediator"]