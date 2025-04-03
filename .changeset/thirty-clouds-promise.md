---
"@credo-ts/openid4vc": minor
"@credo-ts/core": minor
---

add support for OID4VCI draft 15, including wallet and key attestations. With this we have made changes to several APIs to better align with key attestations, and how credential binding resolving works. Instead of calling the holder binding resolver for each credential that will be requested once, it will in total be called once and you can return multiple keys, or a single key attestation. APIs have been simplified to better align with changes in the OID4VCI protocols, but OID4VCI draft 11 and 13 are still fully supported. Support for dc+sd-jwt format has also been added. Note that there have been incompatible metadata display/claim changes in the metadata structure between draft 14 and 15 and thus if you want to support both draft 15 and older drafts you have to make sure you're handling this correctly (e.g. by creating separate configurations to be used with draft 13 or 15), and make sure you're using dc+sd-jwt with draft and vc+sd-jwt with draft 13.
