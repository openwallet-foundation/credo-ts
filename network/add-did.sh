#!/bin/bash

export DID=${1?"Did missing\nUsage: $0 DID VERKEY"}
export VERKEY=${2?"Verkey missing\nUsage: $0 DID VERKEY"}

echo "
wallet open afj-wallet key=password
pool connect afj-pool
did use V4SGRU86Z58d6TV7PBUe6f

ledger nym did=${DID} verkey=${VERKEY} role=TRUST_ANCHOR" >/etc/indy/command.txt

indy-cli --config /etc/indy/indy-cli-config.json /etc/indy/command.txt
