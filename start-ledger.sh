#/bin/sh
docker run -d --rm --name indy-pool -p 9701-9708:9701-9708 indy-pool
docker exec indy-pool indy-cli-setup
docker exec indy-pool add-did-from-seed 000000000000000000000000Trustee9 TRUSTEE

