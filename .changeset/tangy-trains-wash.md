---
"@credo-ts/drizzle-storage": patch
"@credo-ts/question-answer": patch
"@credo-ts/action-menu": patch
"@credo-ts/anoncreds": patch
"@credo-ts/openid4vc": patch
"@credo-ts/didcomm": patch
"@credo-ts/askar": patch
"@credo-ts/webvh": patch
"@credo-ts/core": patch
"@credo-ts/drpc": patch
---

X509 trusted certificates now can be provided in a new format. Previously it was a list of base64/pem/der encoded certificates, but now you can _also_ provide a list of objects in the format `[{issuance: string[], status? :string[]}]`. This is used for the new status indicator on mdoc. First, it looks for the used `issuance` trusted certificates and then validates the `status`, if available, with the `status` trusted certificates associated with the `issuance` property.
