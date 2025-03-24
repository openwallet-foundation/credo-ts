---
"@credo-ts/cheqd": patch
---

fix(cheqd): cheqd revocationRegistryDefinition resource name

Creating two revocation registries with same name would lead to updating the resource. Adding credential definition tag in the resource name fixes this issue
