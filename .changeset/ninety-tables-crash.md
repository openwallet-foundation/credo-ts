---
"@credo-ts/openid4vc": minor
"@credo-ts/core": minor
---

use dc+sd-jwt as SD-JWT VC typ header by default and verify that SD-JWT VCs have either dc+sd-jwt or vc+sd-jwt as typ header. You can still use vc+sd-jwt as typ header by providing the headerType value when signing an SD-JWT VC. For OID4VCI the typ header is based on the oid4vci credential format used.
