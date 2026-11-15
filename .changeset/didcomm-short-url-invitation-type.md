---
'@credo-ts/didcomm': patch
---

An invitation resolved from a shortened URL keeps the invitation type the parser determined. A legacy connectionless invitation behind a short URL was marked as an out-of-band invitation before, so the response carried a `pthid` with a locally generated id the inviter never saw.
