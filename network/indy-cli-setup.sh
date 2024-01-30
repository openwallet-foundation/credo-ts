#!/bin/bash

echo '
wallet create credo-wallet key=password
wallet open credo-wallet key=password

pool create credo-pool gen_txn_file=/etc/indy/genesis.txn
pool connect credo-pool

did new seed=000000000000000000000000Trustee1
did use V4SGRU86Z58d6TV7PBUe6f

ledger txn-acceptance-mechanisms aml={"accept":"accept"} version=1
ledger txn-author-agreement text="taa" version=1 ratification-timestamp=1234' >/etc/indy/command.txt

indy-cli --config /etc/indy/indy-cli-config.json /etc/indy/command.txt
