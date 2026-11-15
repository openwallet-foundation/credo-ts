---
'@credo-ts/core': minor
---

An `Mdoc` no longer takes the key id of its device key from the `kid` in the issuer's mobile security object, because the issuer chooses that value and could make the holder sign with another key. Set `deviceKeyId` on an `Mdoc` before you create a device response with it or store it with `MdocRecord.fromMdoc`. Otherwise the legacy key id is used. Mdocs received through the OpenID4VCI holder already have it set.
