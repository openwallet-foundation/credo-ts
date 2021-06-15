#!/usr/bin/env bash

cd "$(dirname "$0")" || exit
if [ -z "$1" ]; then
    echo 'Must specify "generate" or "update" as first argument'
    exit 1
fi

CONTAINER_RUNTIME=${CONTAINER_RUNTIME:-docker}

${CONTAINER_RUNTIME} build -t openapi-generator -f ./Dockerfile.openapi-generator .

${CONTAINER_RUNTIME} run --rm \
    -v "$(realpath "$PWD/../"):/usr/src/app:z" \
    openapi-generator "$1" --path ./scripts/openapi.yml --config ./scripts/openapi-config.yml
