#!/bin/bash

AGENT="$1"
YARN_COMMAND=yarn


if [[ "$AGENT" = "mediator01" ]] || [[ "$AGENT" = "alice" ]]; then
  AGENT_ENDPOINT="${AGENT_ENDPOINT:-http://localhost:3001}"
  AGENT_HOST=http://localhost
  AGENT_PORT=3001
  AGENT_LABEL=RoutingMediator01
  WALLET_NAME=mediator01
  WALLET_KEY=0000000000000000000000000Mediator01
  PUBLIC_DID=DtWRdd6C5dN5vpcN6XRAvu
  PUBLIC_DID_SEED=00000000000000000000000Forward01
elif [[ "$AGENT" = "mediator02" ]] || [[ "$AGENT" = "bob" ]]; then
  AGENT_ENDPOINT="${AGENT_ENDPOINT:-http://localhost:3002}"
  AGENT_HOST=http://localhost
  AGENT_PORT=3002
  AGENT_LABEL=RoutingMediator02
  WALLET_NAME=mediator02
  WALLET_KEY=0000000000000000000000000Mediator02
  PUBLIC_DID=SHbU5SEwdmkQkVQ1sMwSEv
  PUBLIC_DID_SEED=00000000000000000000000Forward02
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

AGENT_ENDPOINT=${AGENT_ENDPOINT} AGENT_HOST=${AGENT_HOST} AGENT_PORT=${AGENT_PORT} AGENT_LABEL=${AGENT_LABEL} WALLET_NAME=${WALLET_NAME} WALLET_KEY=${WALLET_KEY} PUBLIC_DID=${PUBLIC_DID} PUBLIC_DID_SEED=${PUBLIC_DID_SEED} ${YARN_COMMAND} prod:debug
