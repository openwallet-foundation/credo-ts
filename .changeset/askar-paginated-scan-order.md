---
'@credo-ts/askar': patch
---

`AskarStorageService.findByQuery` now orders paginated queries (with `limit` or `offset`) by insertion order. Before, the database could return the rows of each page in any order, so reading a result page by page could skip or repeat records.
