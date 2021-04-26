#!/bin/bash

AGENT="$1"
YARN_COMMAND=yarn

GENESIS_TXN_PATH="${GENESIS_TXN_PATH:-./network/genesis/local-genesis.txn}"

if [[ "$AGENT" = "mediator01" ]] || [[ "$AGENT" = "alice" ]]; then
  AGENT_ENDPOINT=http://localhost:4001
  AGENT_HOST=http://localhost
  AGENT_PORT=4001
  AGENT_LABEL=MediatorAgent01
  PUBLIC_DID=DtWRdd6C5dN5vpcN6XRAvu
  PUBLIC_DID_SEED=00000000000000000000000Forward01
  WALLET_NAME=mediator01
  WALLET_KEY=0000000000000000000000000Mediator01
elif [[ "$AGENT" = "mediator02" ]] || [[ "$AGENT" = "bob" ]]; then
  AGENT_ENDPOINT=http://localhost:4002
  AGENT_HOST=http://localhost
  AGENT_PORT=4002
  AGENT_LABEL=MediatorAgent02
  PUBLIC_DID=SHbU5SEwdmkQkVQ1sMwSEv
  PUBLIC_DID_SEED=00000000000000000000000Forward02
  WALLET_NAME=mediator02
  WALLET_KEY=0000000000000000000000000Mediator02
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

GENESIS_TXN_PATH=${GENESIS_TXN_PATH} AGENT_ENDPOINT=${AGENT_ENDPOINT} AGENT_HOST=${AGENT_HOST} AGENT_PORT=${AGENT_PORT} AGENT_LABEL=${AGENT_LABEL} WALLET_NAME=${WALLET_NAME} WALLET_KEY=${WALLET_KEY} PUBLIC_DID=${PUBLIC_DID} PUBLIC_DID_SEED=${PUBLIC_DID_SEED} ${YARN_COMMAND} prod:start-mediation-server
