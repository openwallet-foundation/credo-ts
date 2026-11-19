---
'@credo-ts/drizzle-storage': patch
---

Added indexes for the lookups that run for each received DIDComm message. Before, these lookups read all the rows of the tenant in the table, so their time increased with the number of connections and DIDs. The new migrations add these indexes:

- `DidcommConnection`: `did` and `their_did`
- `Did`: `recipient_key_fingerprints` (PostgreSQL only)
- `DidcommMediation`: `recipient_keys` (PostgreSQL only)
- `DidcommOutOfBand`: `recipient_key_fingerprints` (PostgreSQL only) and `recipient_routing_key_fingerprint`

The migrations create the indexes on the existing rows. During the creation, PostgreSQL blocks writes to the table. On large tables, run the migrations at a time with little traffic.
