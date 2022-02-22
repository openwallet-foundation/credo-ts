
# stop any running docker container for indy pool
container=$(docker ps -q --filter ancestor=indy-pool)
echo "container=$container"

if [ -n "$container" ]; then
	echo "stop docker container..."
	docker stop $container
else 	
	echo "no indy pool running"
fi

if [[ "$1" == "--clean" ]]
then
  echo "cleaning Indy Wallet..."
	rm -rf ~/.indy_client
  exit
elif [[ -n "$1" ]]
then
  tests = $1
  echo "run tests in $1"
else
  echo "Running all tests..."
fi

# Build indy pool
docker build -f network/indy-pool.dockerfile -t indy-pool . --platform linux/amd64

# Start indy pool
docker run -d --rm --name indy-pool -p 9701-9708:9701-9708 indy-pool

# Setup CLI. This creates a wallet, connects to the ledger and sets the Transaction Author Agreement
docker exec indy-pool indy-cli-setup

#  DID and Verkey from seed. Set 'Trustee' role in order to be able to register public DIDs
docker exec indy-pool add-did-from-seed 000000000000000000000000Trustee9 TRUSTEE

# If you want to register using the DID/Verkey you can use
# docker exec indy-pool add-did "NkGXDEPgpFGjQKMYmz6SyF" "CrSA1WbYYWLJoHm16Xw1VEeWxFvXtWjtsfEzMsjB5vDT"
# Run all tests
# You can run the tests using the following command.

if [[ -n "$tests" ]]
then
  echo "===================================================="
  echo ">>>>> run tests in $tests <<<<<"
  echo "===================================================="

fi

# yarn test $tests

# to run ony files in a specific folder use something like the following example:
#yarn test ./packages/core/src/modules/credentials/__tests__

# to run only a specific test use something like the following example
#yarn test ./packages/core/src/modules/credentials/__tests__/CredentialInfo.test.ts

# main credentials test 
#yarn test ./packages/core/tests/credentials.test.ts

# new v2 credentials test
#yarn test ./packages/core/tests/credentials.propose.test.ts

