#!/bin/bash

AGENT="$1"
YARN_COMMAND=yarn


if [[ "$AGENT" = "mediator03" ]] || [[ "$AGENT" = "alice-ws" ]]; then
  AGENT_ENDPOINT="${AGENT_ENDPOINT:-http://localhost:3003}"
  AGENT_HOST=http://localhost
  AGENT_PORT=3003
  AGENT_LABEL=RoutingMediator03
  WALLET_NAME=mediator03
  WALLET_KEY=0000000000000000000000000Mediator03
  PUBLIC_DID=DtWRdd6C5dN5vpcN6XRAvu
  PUBLIC_DID_SEED=00000000000000000000000Forward03
elif [[ "$AGENT" = "mediator04" ]] || [[ "$AGENT" = "bob-ws" ]]; then
  AGENT_ENDPOINT="${AGENT_ENDPOINT:-http://localhost:3004}"
  AGENT_HOST=http://localhost
  AGENT_PORT=3004
  AGENT_LABEL=RoutingMediator04
  WALLET_NAME=mediator04
  WALLET_KEY=0000000000000000000000000Mediator04
  PUBLIC_DID=SHbU5SEwdmkQkVQ1sMwSEv
  PUBLIC_DID_SEED=00000000000000000000000Forward04
else
  echo "Please specify which agent you want to run. Choose from 'alice' or 'bob'."
  exit 1
fi

if [ "$2" = "server" ]; then
  YARN_COMMAND=.yarn/bin/yarn
fi

# Docker image already compiles. Not needed to do again
if [ "$RUN_MODE" != "docker" ]; then
  ${YARN_COMMAND} prod:build
fi

AGENT_ENDPOINT=${AGENT_ENDPOINT} AGENT_HOST=${AGENT_HOST} AGENT_PORT=${AGENT_PORT} AGENT_LABEL=${AGENT_LABEL} WALLET_NAME=${WALLET_NAME} WALLET_KEY=${WALLET_KEY} PUBLIC_DID=${PUBLIC_DID} PUBLIC_DID_SEED=${PUBLIC_DID_SEED} ${YARN_COMMAND} prod:start-ws
