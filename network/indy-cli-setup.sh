#!/bin/bash

echo '
wallet create afj-wallet key=password
wallet open afj-wallet key=password

pool create afj-pool gen_txn_file=/etc/indy/genesis.txn
pool connect afj-pool

did new seed=000000000000000000000000Trustee1
did use V4SGRU86Z58d6TV7PBUe6f

ledger txn-acceptance-mechanisms aml={"accept":"accept"} version=1
ledger txn-author-agreement text="taa" version=1 ratification-timestamp=1234' >/etc/indy/command.txt

indy-cli --config /etc/indy/indy-cli-config.json /etc/indy/command.txt
