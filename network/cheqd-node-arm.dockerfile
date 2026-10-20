FROM alpine:3.24 AS cheqd-binary

RUN apk add --no-cache ca-certificates curl

# The upstream 4.2.1 ARM image builds cheqd-noded with GOARCH=amd64; its release archive is native ARM64.
RUN curl --fail --location --retry 3 \
      --output /tmp/cheqd-noded.tar.gz \
      https://github.com/cheqd/cheqd-node/releases/download/v4.2.1/cheqd-noded-4.2.1-linux-arm64.tar.gz \
    && echo "0b51fc501317589272213a8b7f5e799200ef7c040f5d1ab65f5773324878b93a  /tmp/cheqd-noded.tar.gz" | sha256sum -c - \
    && tar -xzf /tmp/cheqd-noded.tar.gz -C /tmp cheqd-noded

FROM ghcr.io/cheqd/cheqd-node:4.2.1

COPY --from=cheqd-binary --chmod=755 /tmp/cheqd-noded /bin/cheqd-noded
