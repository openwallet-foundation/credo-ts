---
"@credo-ts/core": patch
"@credo-ts/openid4vc": patch
---

feat(pex): improve Presentation Exchange 2.1.1 conformance and credential selection

- Resolve LDP-VP proof suites independently from LDP-VC suites and select a compatible authentication key.
- Branch presentation creation on the credential `claimFormat`, enforce the corresponding credential-record type at runtime, and fail fast for unsupported format/record combinations.
- Support recursive `from_nested` submission requirements, including nested `pick` and `all` rules.
- Validate presentation and credential format capabilities independently, including OID4VP draft 21 and 24 compatibility handling.
- Improve PEX v2 credential pre-querying using field and proof-type constraints.
- Preserve submission requirements during selection and support SD-JWT-DC nested submission paths across PEX flows, including the pre-1.0 OpenID4VP drafts where the underlying format is supported.
- Expose predicate support metadata and retain predicate candidates only for W3C AnonCreds credentials with predicate-proof support.
- Handle non-DID subject identifiers and preserve input-descriptor ordering in generated submissions.
- Add the EXTERNAL multi-VP `$[n]` path workaround and document PEX status-constraint behavior where upstream evaluation is unavailable.

OpenID4VP Presentation Exchange remains supported only for pre-1.0 draft versions; OpenID4VP 1.0 uses DCQL. Draft-24 `dc+sd-jwt` support remains dependent on the underlying PEX libraries.
