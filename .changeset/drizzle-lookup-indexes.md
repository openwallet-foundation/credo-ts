---
'@credo-ts/drizzle-storage': patch
---

Added indexes for the lookups that run for each received DIDComm message. Before, these lookups read all the rows of the tenant in the table, so their time increased with the number of connections and DIDs. The new migrations add these indexes:

- `DidcommConnection`: `did` and `their_did`
- `Did`: `did`, and `recipient_key_fingerprints` (PostgreSQL only)
- `DidcommMediation`: `connection_id`, and `recipient_keys` and `recipient_dids` (PostgreSQL only)
- `DidcommOutOfBand`: `recipient_routing_key_fingerprint`, and `recipient_key_fingerprints` (PostgreSQL only)

The migrations create the indexes on the existing rows. During the creation, PostgreSQL blocks writes to the table. On large tables, run the migrations at a time with little traffic.
