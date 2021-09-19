#!/bin/bash

export DID=${1?"Did missing\nUsage: $0 DID VERKEY [ROLE]"}
export VERKEY=${2?"Verkey missing\nUsage: $0 DID VERKEY [ROLE]"}
export ROLE=$3

if [ -z "$ROLE" ]; then
  ROLE=TRUST_ANCHOR
fi

echo "
wallet open afj-wallet key=password
pool connect afj-pool
did use V4SGRU86Z58d6TV7PBUe6f

ledger nym did=${DID} verkey=${VERKEY} role=${ROLE}" >/etc/indy/command.txt

indy-cli --config /etc/indy/indy-cli-config.json /etc/indy/command.txt
