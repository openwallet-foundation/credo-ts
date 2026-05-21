# DIDComm V2 Algorithm Support

This document summarizes which cryptographic algorithms and curves from the [DIDComm Messaging V2 specification](https://identity.foundation/didcomm-messaging/spec/) are currently supported in Credo-TS, and identifies gaps that may impact interoperability.

---

## Encryption

### Curves and Content Encryption Algorithms (Spec §5.1.3)

The spec mandates the first three curves and makes P-521 optional.

| Curve | Key Type | Content Encryption Algorithm | Supported | Notes |
|-------|----------|------------------------------|:---------:|-------|
| X25519 | OKP | A256GCM | ✅ | Used for both authcrypt and anoncrypt |
| X25519 | OKP | A256CBC-HS512 | ❌ | Askar KMS supports it; envelope service hardcodes A256GCM |
| X25519 | OKP | XC20P | ❌ | Askar KMS supports it; envelope service hardcodes A256GCM |
| P-256 | EC | A256GCM | ❌ | Askar KMS supports P-256 keys; envelope service restricted to X25519 |
| P-256 | EC | A256CBC-HS512 | ❌ | Same as above |
| P-384 | EC | A256GCM | ❌ | Askar KMS supports P-384 keys; envelope service restricted to X25519 |
| P-384 | EC | A256CBC-HS512 | ❌ | Same as above |
| P-521 (optional) | EC | A256GCM | ❌ | Not supported |
| P-521 (optional) | EC | A256CBC-HS512 | ❌ | Not supported |

### Key Wrapping Algorithms (Spec §5.1.4)

#### Anoncrypt (ECDH-ES)

| KW Algorithm | Curve | Key Type | Supported | Notes |
|-------------|-------|----------|:---------:|-------|
| ECDH-ES+A256KW | X25519 | OKP | ✅ | |
| ECDH-ES+A256KW | P-256 | EC | ❌ | KMS supports ECDH-ES with P-256; envelope service restricted to X25519 |
| ECDH-ES+A256KW | P-384 | EC | ❌ | KMS supports ECDH-ES with P-384; envelope service restricted to X25519 |
| ECDH-ES+A256KW | P-521 (optional) | EC | ❌ | Not supported |

#### Authcrypt (ECDH-1PU)

| KW Algorithm | Curve | Key Type | Supported | Notes |
|-------------|-------|----------|:---------:|-------|
| ECDH-1PU+A256KW | X25519 | OKP | ✅ | |
| ECDH-1PU+A256KW | P-256 | EC | ❌ | Askar `deriveKey.ts` hardcodes X25519 for ECDH-1PU |
| ECDH-1PU+A256KW | P-384 | EC | ❌ | Same as above |
| ECDH-1PU+A256KW | P-521 (optional) | EC | ❌ | Not supported |

> **Spec deviation:** The ECDH-1PU draft mandates A256CBC-HS512 as the content encryption algorithm for authcrypt. Credo-TS currently uses A256GCM instead.

---

## Signing

### Signing Algorithms (Spec §5.2.1)

The spec states implementations MUST be able to verify all of the following and MUST support signing with at least one.

| Algorithm | Curve | Key Type | Supported | Notes |
|-----------|-------|----------|:---------:|-------|
| EdDSA | Ed25519 | OKP | ✅ | Used for `from_prior` JWT (DID rotation) |
| ES256 | P-256 | EC | ❌ | Not implemented in DIDComm V2 layer |
| ES256K | secp256k1 | EC | ❌ | Not implemented in DIDComm V2 layer |

### Signed Envelope (`application/didcomm-signed+json`)

| Feature | Supported |
|---------|:---------:|
| Creating signed (non-encrypted) DIDComm V2 messages | ❌ |
| Verifying signed (non-encrypted) DIDComm V2 messages | ❌ |

---

## Summary: What We Support Today

| Component | Supported |
|-----------|-----------|
| Encryption curve | X25519 only |
| Content encryption | A256GCM only |
| Anoncrypt key wrapping | ECDH-ES+A256KW (X25519) |
| Authcrypt key wrapping | ECDH-1PU+A256KW (X25519) |
| Signing (from_prior JWT) | EdDSA / Ed25519 |

---

## Interoperability Risk Assessment

### High Risk

| Gap | Risk | Effort |
|-----|------|--------|
| **A256CBC-HS512 not supported** | Spec mandates it for authcrypt (ECDH-1PU). Other implementations following the spec will send authcrypt messages with A256CBC-HS512 that we cannot decrypt. | **Low** — Askar already supports A256CBC-HS512; only the envelope service needs updating. |

### Medium Risk

| Gap | Risk | Effort |
|-----|------|--------|
| **P-256 with ECDH-ES (anoncrypt)** | Mobile wallets using hardware-backed keys (iOS Secure Enclave, Android Keystore) often only support P-256. DIDs from `did:web` or `did:jwk` may also use P-256 exclusively. We cannot encrypt to or decrypt from these parties. | **Medium** — KMS already supports it; envelope service needs generalization beyond `X25519PublicJwk`. |
| **P-256 with ECDH-1PU (authcrypt)** | Same scenarios as ECDH-ES, but for authenticated encryption. | **Higher** — Askar's `deriveKey.ts` hardcodes X25519 for ECDH-1PU; underlying native function may need extension. |

### Low Risk

| Gap | Risk | Effort |
|-----|------|--------|
| **XC20P** | Spec marks it optional. Some libraries use it as default for anoncrypt, but it is not universally required. | **Low** — Askar already supports XC20P. |
| **P-384** | Rarely used in practice among current DIDComm implementations. | Same effort as P-256 support. |
| **Signed envelopes** | Needed for non-repudiation flows; not commonly used in typical messaging. | Separate feature implementation. |
| **ES256 / ES256K signing** | Required for verification per spec, but EdDSA covers most current use cases. | Moderate — needs DIDComm V2 layer changes. |

---

## Where the Restrictions Live

| Layer | File | Restriction |
|-------|------|-------------|
| DIDComm V2 Envelope Service | `packages/didcomm/src/v2/DidCommV2EnvelopeService.ts` | Hardcodes `A256GCM`, rejects other `enc` values. EPK validation rejects non-X25519. |
| DIDComm V2 Key Resolution | `packages/didcomm/src/v2/resolveV2Keys.ts` | Key types restricted to `Kms.PublicJwk<Kms.X25519PublicJwk>`. |
| Askar KMS (ECDH-1PU) | `packages/askar/src/kms/crypto/deriveKey.ts` | `deriveEncryptionKeyEcdh1Pu` asserts X25519 for sender and recipient. Ephemeral key hardcoded as X25519. |
| Askar KMS (ECDH-ES) | `packages/askar/src/kms/crypto/deriveKey.ts` | No curve restriction — works with both OKP and EC keys. |
| Askar Key Types | `packages/askar/src/utils/askarKeyTypes.ts` | P-256, P-384, secp256k1, X25519, Ed25519 all mapped to Askar algorithms. |
| Askar Enc Algorithms | `packages/askar/src/utils/askarKeyTypes.ts` | A256CBC-HS512, A256GCM, XC20P, A128GCM, A128CBC-HS256 all mapped. |

---

## Recommended Priority

1. **A256CBC-HS512 for authcrypt** — Spec compliance, high interop risk, low effort
2. **P-256 support for ECDH-ES (anoncrypt)** — Mobile/web interop, medium effort
3. **P-256 support for ECDH-1PU (authcrypt)** — Full P-256 story, higher effort
4. **XC20P for anoncrypt** — Optional but some libraries default to it, low effort
5. **P-384** — Lower priority, same pattern as P-256
6. **Signed envelopes & ES256/ES256K** — Separate feature track
