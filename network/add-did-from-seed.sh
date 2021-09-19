#!/bin/bash

export SEED=${1?"Seed missing\nUsage: $0 SEED ROLE"}
export ROLE=$2

echo "
wallet open afj-wallet key=password

pool connect afj-pool

did new seed=${SEED}" >/etc/indy/command.txt

export DID_STRING=$(indy-cli --config /etc/indy/indy-cli-config.json /etc/indy/command.txt | grep "has been created with")

IFS='"' read -r -a DID_PARTS <<<"$DID_STRING"
export DID=${DID_PARTS[1]}
export VERKEY=${DID_PARTS[3]}

add-did "$DID" "$VERKEY" "$ROLE"
