---
'@credo-ts/hedera': patch
---

Resolving a revocation status list on Hedera now includes entries from the whole requested second. Before, entries written later in that second were left out. Updating a status list right after an earlier update could then undo that update's revocations.
