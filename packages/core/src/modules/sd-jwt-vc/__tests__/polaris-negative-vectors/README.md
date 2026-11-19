# Polaris negative vectors for SD-JWT VC presentations

38 SD-JWT VC presentations, each with the verdict it expects, vendored unchanged for
`polaris-negative-vectors.test.ts`. Three are valid controls; each of the others changes
one thing in a control, names the clauses its verdict rests on, and has a class that says
how strongly they require it.

- Source: <https://github.com/EgorKhaklin/polaris-id/tree/727e9ee589bc69bfad40674d353b387f587263e0/lab/interop/negative-vectors>,
  commit `727e9ee589bc69bfad40674d353b387f587263e0`
- File: `vectors.json` (version 0.6.0), SHA-256 `e3166e6fb30ff5dabd6b81284bd9a95c5ab0b41db077e82a32f5d67a2357778c`
- Licence: Apache-2.0, Copyright 2026 Egor Khaklin, in `LICENSE` and `NOTICE` beside this file

The test runs the vectors whose issuer key comes from an x5c chain, 36 of the 38; the other
two give their issuer key as a JWK, in `settings.issuer_jwks`. Each status list is served
from its vector, and the test reads nothing from the network. The keys and certificates are test material.

Do not edit these files: replace them with a newer commit from the same repository.
