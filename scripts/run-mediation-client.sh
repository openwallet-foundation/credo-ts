#!/bin/bash

AGENT="$1"
YARN_COMMAND=yarn

GENESIS_TXN_PATH="${GENESIS_TXN_PATH:-./network/genesis/local-genesis.txn}"
MEDIATOR_INVITATION_ENDPOINT="${MEDIATOR_INVITATION_ENDPOINT:-http://localhost:4001/invitation}"

if [[ "$AGENT" = "edge01" ]] || [[ "$AGENT" = "alice" ]]; then
  AGENT_ENDPOINT=
  AGENT_HOST=
  AGENT_PORT=3001
  AGENT_LABEL=EdgeAgent01
  WALLET_NAME=edge01
  WALLET_KEY=0000000000000000000000000Edge01
elif [[ "$AGENT" = "edge02" ]] || [[ "$AGENT" = "bob" ]]; then
  AGENT_ENDPOINT=
  AGENT_HOST=
  AGENT_PORT=3002
  AGENT_LABEL=EdgeAgent02
  WALLET_NAME=edge02
  WALLET_KEY=0000000000000000000000000Edge02
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

MEDIATOR_INVITATION_ENDPOINT=${MEDIATOR_INVITATION_ENDPOINT} GENESIS_TXN_PATH=${GENESIS_TXN_PATH} AGENT_ENDPOINT=${AGENT_ENDPOINT} AGENT_HOST=${AGENT_HOST} AGENT_PORT=${AGENT_PORT} AGENT_LABEL=${AGENT_LABEL} WALLET_NAME=${WALLET_NAME} WALLET_KEY=${WALLET_KEY} PUBLIC_DID=${PUBLIC_DID} PUBLIC_DID_SEED=${PUBLIC_DID_SEED} ${YARN_COMMAND} prod:start-mediation-client
