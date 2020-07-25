#!/bin/bash

AGENT="$1"
YARN_COMMAND=yarn
COMMAND=prod

# Docker image already compiles. Not needed to do again
if [ "$RUN_MODE" = "docker" ]; then
  COMMAND="prod:start"
fi

if [[ "$AGENT" = "agency01" ]] || [[ "$AGENT" = "alice" ]]; then
  AGENT_URL=http://localhost
  AGENT_PORT=3001
  AGENT_LABEL=RoutingAgency01
  WALLET_NAME=agency01
  WALLET_KEY=000000000000000000000000000Agency01
  PUBLIC_DID=DtWRdd6C5dN5vpcN6XRAvu
  PUBLIC_DID_SEED=00000000000000000000000Forward01
elif [[ "$AGENT" = "agency02" ]] || [[ "$AGENT" = "bob" ]]; then
  AGENT_URL=http://localhost
  AGENT_PORT=3002
  AGENT_LABEL=RoutingAgency02
  WALLET_NAME=agency02
  WALLET_KEY=000000000000000000000000000Agency02
  PUBLIC_DID=SHbU5SEwdmkQkVQ1sMwSEv
  PUBLIC_DID_SEED=00000000000000000000000Forward02
else
  echo "Please specify which agent you want to run. Choose from 'alice' or 'bob'."
  exit 1
fi

if [ "$2" = "server" ]; then
  YARN_COMMAND=.yarn/bin/yarn
fi

AGENT_URL=${AGENT_URL} AGENT_PORT=${AGENT_PORT} AGENT_LABEL=${AGENT_LABEL} WALLET_NAME=${WALLET_NAME} WALLET_KEY=${WALLET_KEY} PUBLIC_DID=${PUBLIC_DID} PUBLIC_DID_SEED=${PUBLIC_DID_SEED} ${YARN_COMMAND} ${COMMAND}
