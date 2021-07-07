#!/bin/bash

AGENT="$1"
YARN_COMMAND=yarn
BUILD="$2"


if [[ "$AGENT" = "mediator01" ]] || [[ "$AGENT" = "alice" ]]; then
  AGENT_ENDPOINT="${AGENT_ENDPOINT:-http://localhost:3001}"
  AGENT_HOST=http://localhost
  AGENT_PORT=3001
  AGENT_LABEL=RoutingMediator01
  WALLET_NAME=mediator01
  WALLET_KEY=0000000000000000000000000Mediator01
  PUBLIC_DID_SEED=00000000000000000000000Forward01
  MEDIATOR_COMMAND="run-mediator"
elif [[ "$AGENT" = "mediator02" ]] || [[ "$AGENT" = "bob" ]]; then
  AGENT_ENDPOINT="${AGENT_ENDPOINT:-http://localhost:3002}"
  AGENT_HOST=http://localhost
  AGENT_PORT=3002
  AGENT_LABEL=RoutingMediator02
  WALLET_NAME=mediator02
  WALLET_KEY=0000000000000000000000000Mediator02
  PUBLIC_DID_SEED=00000000000000000000000Forward02
  MEDIATOR_COMMAND="run-mediator"
elif [[ "$AGENT" = "mediator03" ]] || [[ "$AGENT" = "alice-ws" ]]; then
  AGENT_ENDPOINT="${AGENT_ENDPOINT:-http://localhost:3003}"
  AGENT_HOST=http://localhost
  AGENT_PORT=3003
  AGENT_LABEL=RoutingMediator03
  WALLET_NAME=mediator03
  WALLET_KEY=0000000000000000000000000Mediator03
  PUBLIC_DID=DtWRdd6C5dN5vpcN6XRAvu
  PUBLIC_DID_SEED=00000000000000000000000Forward03
  MEDIATOR_COMMAND="run-mediator-ws"
elif [[ "$AGENT" = "mediator04" ]] || [[ "$AGENT" = "bob-ws" ]]; then
  AGENT_ENDPOINT="${AGENT_ENDPOINT:-http://localhost:3004}"
  AGENT_HOST=http://localhost
  AGENT_PORT=3004
  AGENT_LABEL=RoutingMediator04
  WALLET_NAME=mediator04
  WALLET_KEY=0000000000000000000000000Mediator04
  PUBLIC_DID=SHbU5SEwdmkQkVQ1sMwSEv
  PUBLIC_DID_SEED=00000000000000000000000Forward04
  MEDIATOR_COMMAND="run-mediator-ws"
else
  echo "Please specify which agent you want to run. Choose from 'alice', 'alice-ws', 'bob' or 'bob-ws'."
  exit 1
fi

AGENT_ENDPOINT=${AGENT_ENDPOINT} AGENT_HOST=${AGENT_HOST} AGENT_PORT=${AGENT_PORT} AGENT_LABEL=${AGENT_LABEL} WALLET_NAME=${WALLET_NAME} WALLET_KEY=${WALLET_KEY} PUBLIC_DID=${PUBLIC_DID} PUBLIC_DID_SEED=${PUBLIC_DID_SEED} ${YARN_COMMAND} ${MEDIATOR_COMMAND}
