---
"@credo-ts/core": patch
---

Fixed signing a JSON-LD credential or presentation created with `new W3cCredential()` / `new W3cPresentation()` without an `expirationDate` or `id`. The constructors assigned `undefined` to these optional fields, the keys survived serialization, and JSON-LD signing rejected them. This also affected OpenID4VP `ldp_vp` presentations built by the DCQL service.
