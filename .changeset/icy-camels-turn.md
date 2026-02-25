---
"@credo-ts/drizzle-storage": patch
"@credo-ts/askar": patch
"@credo-ts/core": patch
---

Introduced cursor-based pagination for Drizzle-backed storage with support for before and after cursors. This ensures stable ordering using (createdAt, id) and enables efficient bidirectional pagination for large number of records.
