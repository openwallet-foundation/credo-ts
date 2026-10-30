---
'@credo-ts/didcomm': patch
---

Fixed lost did services when cloning an out-of-band record. If the record was loaded from storage or the invitation was received, a clone had an empty string for every did service of the invitation. The records in record events and out-of-band state changed events are clones, so listeners got invitations without their did services. Stored records were not affected.
