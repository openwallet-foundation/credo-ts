FROM node:25.9.0-bookworm

# Set working directory
WORKDIR /www

# Copy repository files
COPY . . 

RUN corepack enable

# Run pnpm install and build
RUN pnpm install --frozen-lockfile \
    && pnpm build

ENTRYPOINT ["pnpm", "run-mediator"]