---
'@credo-ts/didcomm': patch
---

The data integrity credential format now verifies a received VC Data Model 1.1 credential that has no AnonCreds link secret binding before storing it, including the issuer trust check. Before, only VC Data Model 2.0 credentials were verified.
