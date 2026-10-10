/** simpleJwtVcWithCnfJwkKid
 * {
 *   "jwt": {
 *     "header": {
 *       "typ": "vc+sd-jwt",
 *       "alg": "EdDSA",
 *       "kid": "#z6MktqtXNG8CDUY9PrrtoStFzeCnhpMmgxYL1gikcW3BzvNW"
 *     },
 *     "payload": {
 *       "claim": "some-claim",
 *       "vct": "IdentityCredential",
 *       "cnf": {
 *         "jwk": {
 *           "kty": "OKP",
 *           "kid": "BnbnQW5VWoys6x6qYxEUVrEKGYW2GS5vG71vCMwwfsYm",
 *           "crv": "Ed25519",
 *           "x": "oENVsxOUiH54X8wJLaVkicCRk00wBIQ4sRgbk54N8Mo"
 *         }
 *       },
 *       "iss": "did:key:z6MktqtXNG8CDUY9PrrtoStFzeCnhpMmgxYL1gikcW3BzvNW",
 *       "iat": 1698151532
 *     },
 *     "signature": "mVaO61d9YYRbzWATBztGw2axg-2zjYWtNp5BVxhoi4RW6VQGjlJtn8OY7j8RLnkcMYKVvakQO56_Rco-vy2kAA"
 *   },
 *   "disclosures": []
 * }
 */
export const simpleJwtVcWithCnfJwkKid =
  'eyJ0eXAiOiJ2YytzZC1qd3QiLCJhbGciOiJFZERTQSIsImtpZCI6IiN6Nk1rdHF0WE5HOENEVVk5UHJydG9TdEZ6ZUNuaHBNbWd4WUwxZ2lrY1czQnp2TlcifQ.eyJjbGFpbSI6InNvbWUtY2xhaW0iLCJ2Y3QiOiJJZGVudGl0eUNyZWRlbnRpYWwiLCJjbmYiOnsiandrIjp7Imt0eSI6Ik9LUCIsImtpZCI6IkJuYm5RVzVWV295czZ4NnFZeEVVVnJFS0dZVzJHUzV2RzcxdkNNd3dmc1ltIiwiY3J2IjoiRWQyNTUxOSIsIngiOiJvRU5Wc3hPVWlINTRYOHdKTGFWa2ljQ1JrMDB3QklRNHNSZ2JrNTROOE1vIn19LCJpc3MiOiJkaWQ6a2V5Ono2TWt0cXRYTkc4Q0RVWTlQcnJ0b1N0RnplQ25ocE1tZ3hZTDFnaWtjVzNCenZOVyIsImlhdCI6MTY5ODE1MTUzMn0.mVaO61d9YYRbzWATBztGw2axg-2zjYWtNp5BVxhoi4RW6VQGjlJtn8OY7j8RLnkcMYKVvakQO56_Rco-vy2kAA~'

/** simpleJwtVcPresentationWithCnfJwkKid
 * {
 *   "jwt": {
 *     "header": {
 *       "typ": "vc+sd-jwt",
 *       "alg": "EdDSA",
 *       "kid": "#z6MktqtXNG8CDUY9PrrtoStFzeCnhpMmgxYL1gikcW3BzvNW"
 *     },
 *     "payload": {
 *       "claim": "some-claim",
 *       "vct": "IdentityCredential",
 *       "cnf": {
 *         "jwk": {
 *           "kty": "OKP",
 *           "kid": "BnbnQW5VWoys6x6qYxEUVrEKGYW2GS5vG71vCMwwfsYm",
 *           "crv": "Ed25519",
 *           "x": "oENVsxOUiH54X8wJLaVkicCRk00wBIQ4sRgbk54N8Mo"
 *         }
 *       },
 *       "iss": "did:key:z6MktqtXNG8CDUY9PrrtoStFzeCnhpMmgxYL1gikcW3BzvNW",
 *       "iat": 1698151532
 *     },
 *     "signature": "mVaO61d9YYRbzWATBztGw2axg-2zjYWtNp5BVxhoi4RW6VQGjlJtn8OY7j8RLnkcMYKVvakQO56_Rco-vy2kAA"
 *   },
 *   "disclosures": [],
 *   "kbJwt": {
 *     "header": {
 *       "typ": "kb+jwt",
 *       "alg": "EdDSA"
 *     },
 *     "payload": {
 *       "iat": 1698151532,
 *       "nonce": "salt",
 *       "aud": "did:key:zUC74VEqqhEHQcgv4zagSPkqFJxuNWuoBPKjJuHETEUeHLoSqWt92viSsmaWjy82y",
 *       "sd_hash": "x_Tfds9dHpznffcjzQrow-cKT5rllll7xb2SMhr192Q"
 *     },
 *     "signature": "OndMm3YfGko5Zzqdm6wM88mwjXVR8MXpvMmmE3lU9RoC719h4mWH6R0DC2qLC8wK1S9TvIF8ZDHKaAMlGvfYBw"
 *   }
 * }
 */
export const simpleJwtVcPresentationWithCnfJwkKid =
  'eyJ0eXAiOiJ2YytzZC1qd3QiLCJhbGciOiJFZERTQSIsImtpZCI6IiN6Nk1rdHF0WE5HOENEVVk5UHJydG9TdEZ6ZUNuaHBNbWd4WUwxZ2lrY1czQnp2TlcifQ.eyJjbGFpbSI6InNvbWUtY2xhaW0iLCJ2Y3QiOiJJZGVudGl0eUNyZWRlbnRpYWwiLCJjbmYiOnsiandrIjp7Imt0eSI6Ik9LUCIsImtpZCI6IkJuYm5RVzVWV295czZ4NnFZeEVVVnJFS0dZVzJHUzV2RzcxdkNNd3dmc1ltIiwiY3J2IjoiRWQyNTUxOSIsIngiOiJvRU5Wc3hPVWlINTRYOHdKTGFWa2ljQ1JrMDB3QklRNHNSZ2JrNTROOE1vIn19LCJpc3MiOiJkaWQ6a2V5Ono2TWt0cXRYTkc4Q0RVWTlQcnJ0b1N0RnplQ25ocE1tZ3hZTDFnaWtjVzNCenZOVyIsImlhdCI6MTY5ODE1MTUzMn0.mVaO61d9YYRbzWATBztGw2axg-2zjYWtNp5BVxhoi4RW6VQGjlJtn8OY7j8RLnkcMYKVvakQO56_Rco-vy2kAA~eyJ0eXAiOiJrYitqd3QiLCJhbGciOiJFZERTQSJ9.eyJpYXQiOjE2OTgxNTE1MzIsIm5vbmNlIjoic2FsdCIsImF1ZCI6ImRpZDprZXk6elVDNzRWRXFxaEVIUWNndjR6YWdTUGtxRkp4dU5XdW9CUEtqSnVIRVRFVWVITG9TcVd0OTJ2aVNzbWFXank4MnkiLCJzZF9oYXNoIjoieF9UZmRzOWRIcHpuZmZjanpRcm93LWNLVDVybGxsbDd4YjJTTWhyMTkyUSJ9.OndMm3YfGko5Zzqdm6wM88mwjXVR8MXpvMmmE3lU9RoC719h4mWH6R0DC2qLC8wK1S9TvIF8ZDHKaAMlGvfYBw'

/** sdJwtVcWithSingleDisclosureWithCnfJwkKid
 * {
 *   "jwt": {
 *     "header": {
 *       "typ": "vc+sd-jwt",
 *       "alg": "EdDSA",
 *       "kid": "#z6MktqtXNG8CDUY9PrrtoStFzeCnhpMmgxYL1gikcW3BzvNW"
 *     },
 *     "payload": {
 *       "vct": "IdentityCredential",
 *       "cnf": {
 *         "jwk": {
 *           "kty": "OKP",
 *           "kid": "BnbnQW5VWoys6x6qYxEUVrEKGYW2GS5vG71vCMwwfsYm",
 *           "crv": "Ed25519",
 *           "x": "oENVsxOUiH54X8wJLaVkicCRk00wBIQ4sRgbk54N8Mo"
 *         }
 *       },
 *       "iss": "did:key:z6MktqtXNG8CDUY9PrrtoStFzeCnhpMmgxYL1gikcW3BzvNW",
 *       "iat": 1698151532,
 *       "_sd": [
 *         "LHLZVlumA3_k-zntrSL6ocULVh_uz0PQoupZS4hu15M"
 *       ],
 *       "_sd_alg": "sha-256"
 *     },
 *     "signature": "u6NtGsC0QinrfCCRGcnTTcCqy4uyB-jywCKx3O00quMJW9KjspKGMjH-cp4p_-XLmtzLIqiurFvhR1Kbrvn6CQ"
 *   },
 *   "disclosures": [
 *     {
 *       "_digest": "LHLZVlumA3_k-zntrSL6ocULVh_uz0PQoupZS4hu15M",
 *       "_encoded": "WyJjMkZzZEEiLCJjbGFpbSIsInNvbWUtY2xhaW0iXQ",
 *       "salt": "c2FsdA",
 *       "key": "claim",
 *       "value": "some-claim"
 *     }
 *   ]
 * }
 */
export const sdJwtVcWithSingleDisclosureWithCnfJwkKid =
  'eyJ0eXAiOiJ2YytzZC1qd3QiLCJhbGciOiJFZERTQSIsImtpZCI6IiN6Nk1rdHF0WE5HOENEVVk5UHJydG9TdEZ6ZUNuaHBNbWd4WUwxZ2lrY1czQnp2TlcifQ.eyJ2Y3QiOiJJZGVudGl0eUNyZWRlbnRpYWwiLCJjbmYiOnsiandrIjp7Imt0eSI6Ik9LUCIsImtpZCI6IkJuYm5RVzVWV295czZ4NnFZeEVVVnJFS0dZVzJHUzV2RzcxdkNNd3dmc1ltIiwiY3J2IjoiRWQyNTUxOSIsIngiOiJvRU5Wc3hPVWlINTRYOHdKTGFWa2ljQ1JrMDB3QklRNHNSZ2JrNTROOE1vIn19LCJpc3MiOiJkaWQ6a2V5Ono2TWt0cXRYTkc4Q0RVWTlQcnJ0b1N0RnplQ25ocE1tZ3hZTDFnaWtjVzNCenZOVyIsImlhdCI6MTY5ODE1MTUzMiwiX3NkIjpbIkxITFpWbHVtQTNfay16bnRyU0w2b2NVTFZoX3V6MFBRb3VwWlM0aHUxNU0iXSwiX3NkX2FsZyI6InNoYS0yNTYifQ.u6NtGsC0QinrfCCRGcnTTcCqy4uyB-jywCKx3O00quMJW9KjspKGMjH-cp4p_-XLmtzLIqiurFvhR1Kbrvn6CQ~WyJjMkZzZEEiLCJjbGFpbSIsInNvbWUtY2xhaW0iXQ~'

/** sdJwtVcWithSingleDisclosurePresentationWithCnfJwkKid
 * {
 *   "jwt": {
 *     "header": {
 *       "typ": "vc+sd-jwt",
 *       "alg": "EdDSA",
 *       "kid": "#z6MktqtXNG8CDUY9PrrtoStFzeCnhpMmgxYL1gikcW3BzvNW"
 *     },
 *     "payload": {
 *       "vct": "IdentityCredential",
 *       "cnf": {
 *         "jwk": {
 *           "kty": "OKP",
 *           "kid": "BnbnQW5VWoys6x6qYxEUVrEKGYW2GS5vG71vCMwwfsYm",
 *           "crv": "Ed25519",
 *           "x": "oENVsxOUiH54X8wJLaVkicCRk00wBIQ4sRgbk54N8Mo"
 *         }
 *       },
 *       "iss": "did:key:z6MktqtXNG8CDUY9PrrtoStFzeCnhpMmgxYL1gikcW3BzvNW",
 *       "iat": 1698151532,
 *       "_sd": [
 *         "LHLZVlumA3_k-zntrSL6ocULVh_uz0PQoupZS4hu15M"
 *       ],
 *       "_sd_alg": "sha-256"
 *     },
 *     "signature": "u6NtGsC0QinrfCCRGcnTTcCqy4uyB-jywCKx3O00quMJW9KjspKGMjH-cp4p_-XLmtzLIqiurFvhR1Kbrvn6CQ"
 *   },
 *   "disclosures": [
 *     {
 *       "_digest": "LHLZVlumA3_k-zntrSL6ocULVh_uz0PQoupZS4hu15M",
 *       "_encoded": "WyJjMkZzZEEiLCJjbGFpbSIsInNvbWUtY2xhaW0iXQ",
 *       "salt": "c2FsdA",
 *       "key": "claim",
 *       "value": "some-claim"
 *     }
 *   ],
 *   "kbJwt": {
 *     "header": {
 *       "typ": "kb+jwt",
 *       "alg": "EdDSA"
 *     },
 *     "payload": {
 *       "iat": 1698151532,
 *       "nonce": "salt",
 *       "aud": "did:key:zUC74VEqqhEHQcgv4zagSPkqFJxuNWuoBPKjJuHETEUeHLoSqWt92viSsmaWjy82y",
 *       "sd_hash": "Uq-V5u_s_Zklr2D_Cfgde74ESPtBg-EyhGhftpWMadM"
 *     },
 *     "signature": "Fv2pj-s7tZj0mYb2Oh3d_qWhddnU5ZhywaLvLAe3-QJDggjExua0WXqYZhW6imGmLvUCikpWMP75pyNp9o_uBg"
 *   }
 * }
 */
export const sdJwtVcWithSingleDisclosurePresentationWithCnfJwkKid =
  'eyJ0eXAiOiJ2YytzZC1qd3QiLCJhbGciOiJFZERTQSIsImtpZCI6IiN6Nk1rdHF0WE5HOENEVVk5UHJydG9TdEZ6ZUNuaHBNbWd4WUwxZ2lrY1czQnp2TlcifQ.eyJ2Y3QiOiJJZGVudGl0eUNyZWRlbnRpYWwiLCJjbmYiOnsiandrIjp7Imt0eSI6Ik9LUCIsImtpZCI6IkJuYm5RVzVWV295czZ4NnFZeEVVVnJFS0dZVzJHUzV2RzcxdkNNd3dmc1ltIiwiY3J2IjoiRWQyNTUxOSIsIngiOiJvRU5Wc3hPVWlINTRYOHdKTGFWa2ljQ1JrMDB3QklRNHNSZ2JrNTROOE1vIn19LCJpc3MiOiJkaWQ6a2V5Ono2TWt0cXRYTkc4Q0RVWTlQcnJ0b1N0RnplQ25ocE1tZ3hZTDFnaWtjVzNCenZOVyIsImlhdCI6MTY5ODE1MTUzMiwiX3NkIjpbIkxITFpWbHVtQTNfay16bnRyU0w2b2NVTFZoX3V6MFBRb3VwWlM0aHUxNU0iXSwiX3NkX2FsZyI6InNoYS0yNTYifQ.u6NtGsC0QinrfCCRGcnTTcCqy4uyB-jywCKx3O00quMJW9KjspKGMjH-cp4p_-XLmtzLIqiurFvhR1Kbrvn6CQ~WyJjMkZzZEEiLCJjbGFpbSIsInNvbWUtY2xhaW0iXQ~eyJ0eXAiOiJrYitqd3QiLCJhbGciOiJFZERTQSJ9.eyJpYXQiOjE2OTgxNTE1MzIsIm5vbmNlIjoic2FsdCIsImF1ZCI6ImRpZDprZXk6elVDNzRWRXFxaEVIUWNndjR6YWdTUGtxRkp4dU5XdW9CUEtqSnVIRVRFVWVITG9TcVd0OTJ2aVNzbWFXank4MnkiLCJzZF9oYXNoIjoiVXEtVjV1X3NfWmtscjJEX0NmZ2RlNzRFU1B0QmctRXloR2hmdHBXTWFkTSJ9.Fv2pj-s7tZj0mYb2Oh3d_qWhddnU5ZhywaLvLAe3-QJDggjExua0WXqYZhW6imGmLvUCikpWMP75pyNp9o_uBg'

/** complexSdJwtVcWithCnfJwkKid
 * {
 *   "jwt": {
 *     "header": {
 *       "typ": "vc+sd-jwt",
 *       "alg": "EdDSA",
 *       "kid": "#z6MktqtXNG8CDUY9PrrtoStFzeCnhpMmgxYL1gikcW3BzvNW"
 *     },
 *     "payload": {
 *       "vct": "IdentityCredential",
 *       "family_name": "Doe",
 *       "phone_number": "+1-202-555-0101",
 *       "address": {
 *         "street_address": "123 Main St",
 *         "locality": "Anytown",
 *         "_sd": [
 *           "8Kl-6KGl7JjFrlN0ZKDPKzeRfo0oJ5Tv0F6cXgpmOCY",
 *           "cxH6g51BOh8vDiQXW88Kq896DEVLZZ4mbuLO6z__5ds"
 *         ]
 *       },
 *       "cnf": {
 *         "jwk": {
 *           "kty": "OKP",
 *           "kid": "BnbnQW5VWoys6x6qYxEUVrEKGYW2GS5vG71vCMwwfsYm",
 *           "crv": "Ed25519",
 *           "x": "oENVsxOUiH54X8wJLaVkicCRk00wBIQ4sRgbk54N8Mo"
 *         }
 *       },
 *       "iss": "did:key:z6MktqtXNG8CDUY9PrrtoStFzeCnhpMmgxYL1gikcW3BzvNW",
 *       "iat": 1698151532,
 *       "_sd": [
 *         "1oLbHVhfmVs2oA3vhFNTXhMw4lGu7ql9dZ0T7p-vWqE",
 *         "2xuzS3kUrT6VPJD-MySIkQ47HIB-gcyzF5NDY19cPBw",
 *         "hn1gcrO_Q2HskW2Z_nzIrIl6KpgqldvScozutJdbhWM",
 *         "jc73t3yBoDs_pDYb03lEYKYvCbtCq9NhuJ6_5A7QNSs",
 *         "lKI_sY05pDIs9MDrjCO4v8XoDM963JXxrp9T2FNLyTY",
 *         "sl0hkY5LeVwy3rIjNaCl4P4CJ3C3v8Ip-GH2lB9Sd_A"
 *       ],
 *       "_sd_alg": "sha-256"
 *     },
 *     "signature": "osvw_Favqx8KtupHNr_Rk-zR8iOIav0fQ5Lf_F1v1n1LjVtx-_CkNFSujUnkNfo5HPiQRsvyu5ab0UX6Z7vpCw"
 *   },
 *   "disclosures": [
 *     {
 *       "_digest": "cxH6g51BOh8vDiQXW88Kq896DEVLZZ4mbuLO6z__5ds",
 *       "_encoded": "WyJjMkZzZEEiLCJyZWdpb24iLCJBbnlzdGF0ZSJd",
 *       "salt": "c2FsdA",
 *       "key": "region",
 *       "value": "Anystate"
 *     },
 *     {
 *       "_digest": "8Kl-6KGl7JjFrlN0ZKDPKzeRfo0oJ5Tv0F6cXgpmOCY",
 *       "_encoded": "WyJjMkZzZEEiLCJjb3VudHJ5IiwiVVMiXQ",
 *       "salt": "c2FsdA",
 *       "key": "country",
 *       "value": "US"
 *     },
 *     {
 *       "_digest": "1oLbHVhfmVs2oA3vhFNTXhMw4lGu7ql9dZ0T7p-vWqE",
 *       "_encoded": "WyJjMkZzZEEiLCJnaXZlbl9uYW1lIiwiSm9obiJd",
 *       "salt": "c2FsdA",
 *       "key": "given_name",
 *       "value": "John"
 *     },
 *     {
 *       "_digest": "sl0hkY5LeVwy3rIjNaCl4P4CJ3C3v8Ip-GH2lB9Sd_A",
 *       "_encoded": "WyJjMkZzZEEiLCJlbWFpbCIsImpvaG5kb2VAZXhhbXBsZS5jb20iXQ",
 *       "salt": "c2FsdA",
 *       "key": "email",
 *       "value": "johndoe@example.com"
 *     },
 *     {
 *       "_digest": "hn1gcrO_Q2HskW2Z_nzIrIl6KpgqldvScozutJdbhWM",
 *       "_encoded": "WyJjMkZzZEEiLCJiaXJ0aGRhdGUiLCIxOTQwLTAxLTAxIl0",
 *       "salt": "c2FsdA",
 *       "key": "birthdate",
 *       "value": "1940-01-01"
 *     },
 *     {
 *       "_digest": "lKI_sY05pDIs9MDrjCO4v8XoDM963JXxrp9T2FNLyTY",
 *       "_encoded": "WyJjMkZzZEEiLCJpc19vdmVyXzE4Iix0cnVlXQ",
 *       "salt": "c2FsdA",
 *       "key": "is_over_18",
 *       "value": true
 *     },
 *     {
 *       "_digest": "jc73t3yBoDs_pDYb03lEYKYvCbtCq9NhuJ6_5A7QNSs",
 *       "_encoded": "WyJjMkZzZEEiLCJpc19vdmVyXzIxIix0cnVlXQ",
 *       "salt": "c2FsdA",
 *       "key": "is_over_21",
 *       "value": true
 *     },
 *     {
 *       "_digest": "2xuzS3kUrT6VPJD-MySIkQ47HIB-gcyzF5NDY19cPBw",
 *       "_encoded": "WyJjMkZzZEEiLCJpc19vdmVyXzY1Iix0cnVlXQ",
 *       "salt": "c2FsdA",
 *       "key": "is_over_65",
 *       "value": true
 *     }
 *   ]
 * }
 */
export const complexSdJwtVcWithCnfJwkKid =
  'eyJ0eXAiOiJ2YytzZC1qd3QiLCJhbGciOiJFZERTQSIsImtpZCI6IiN6Nk1rdHF0WE5HOENEVVk5UHJydG9TdEZ6ZUNuaHBNbWd4WUwxZ2lrY1czQnp2TlcifQ.eyJ2Y3QiOiJJZGVudGl0eUNyZWRlbnRpYWwiLCJmYW1pbHlfbmFtZSI6IkRvZSIsInBob25lX251bWJlciI6IisxLTIwMi01NTUtMDEwMSIsImFkZHJlc3MiOnsic3RyZWV0X2FkZHJlc3MiOiIxMjMgTWFpbiBTdCIsImxvY2FsaXR5IjoiQW55dG93biIsIl9zZCI6WyI4S2wtNktHbDdKakZybE4wWktEUEt6ZVJmbzBvSjVUdjBGNmNYZ3BtT0NZIiwiY3hINmc1MUJPaDh2RGlRWFc4OEtxODk2REVWTFpaNG1idUxPNnpfXzVkcyJdfSwiY25mIjp7Imp3ayI6eyJrdHkiOiJPS1AiLCJraWQiOiJCbmJuUVc1VldveXM2eDZxWXhFVVZyRUtHWVcyR1M1dkc3MXZDTXd3ZnNZbSIsImNydiI6IkVkMjU1MTkiLCJ4Ijoib0VOVnN4T1VpSDU0WDh3SkxhVmtpY0NSazAwd0JJUTRzUmdiazU0TjhNbyJ9fSwiaXNzIjoiZGlkOmtleTp6Nk1rdHF0WE5HOENEVVk5UHJydG9TdEZ6ZUNuaHBNbWd4WUwxZ2lrY1czQnp2TlciLCJpYXQiOjE2OTgxNTE1MzIsIl9zZCI6WyIxb0xiSFZoZm1WczJvQTN2aEZOVFhoTXc0bEd1N3FsOWRaMFQ3cC12V3FFIiwiMnh1elMza1VyVDZWUEpELU15U0lrUTQ3SElCLWdjeXpGNU5EWTE5Y1BCdyIsImhuMWdjck9fUTJIc2tXMlpfbnpJcklsNktwZ3FsZHZTY296dXRKZGJoV00iLCJqYzczdDN5Qm9Ec19wRFliMDNsRVlLWXZDYnRDcTlOaHVKNl81QTdRTlNzIiwibEtJX3NZMDVwRElzOU1EcmpDTzR2OFhvRE05NjNKWHhycDlUMkZOTHlUWSIsInNsMGhrWTVMZVZ3eTNySWpOYUNsNFA0Q0ozQzN2OElwLUdIMmxCOVNkX0EiXSwiX3NkX2FsZyI6InNoYS0yNTYifQ.osvw_Favqx8KtupHNr_Rk-zR8iOIav0fQ5Lf_F1v1n1LjVtx-_CkNFSujUnkNfo5HPiQRsvyu5ab0UX6Z7vpCw~WyJjMkZzZEEiLCJyZWdpb24iLCJBbnlzdGF0ZSJd~WyJjMkZzZEEiLCJjb3VudHJ5IiwiVVMiXQ~WyJjMkZzZEEiLCJnaXZlbl9uYW1lIiwiSm9obiJd~WyJjMkZzZEEiLCJlbWFpbCIsImpvaG5kb2VAZXhhbXBsZS5jb20iXQ~WyJjMkZzZEEiLCJiaXJ0aGRhdGUiLCIxOTQwLTAxLTAxIl0~WyJjMkZzZEEiLCJpc19vdmVyXzE4Iix0cnVlXQ~WyJjMkZzZEEiLCJpc19vdmVyXzIxIix0cnVlXQ~WyJjMkZzZEEiLCJpc19vdmVyXzY1Iix0cnVlXQ~'

/** complexSdJwtVcPresentationWithCnfJwkKid
 * {
 *   "jwt": {
 *     "header": {
 *       "typ": "vc+sd-jwt",
 *       "alg": "EdDSA",
 *       "kid": "#z6MktqtXNG8CDUY9PrrtoStFzeCnhpMmgxYL1gikcW3BzvNW"
 *     },
 *     "payload": {
 *       "vct": "IdentityCredential",
 *       "family_name": "Doe",
 *       "phone_number": "+1-202-555-0101",
 *       "address": {
 *         "street_address": "123 Main St",
 *         "locality": "Anytown",
 *         "_sd": [
 *           "8Kl-6KGl7JjFrlN0ZKDPKzeRfo0oJ5Tv0F6cXgpmOCY",
 *           "cxH6g51BOh8vDiQXW88Kq896DEVLZZ4mbuLO6z__5ds"
 *         ]
 *       },
 *       "cnf": {
 *         "jwk": {
 *           "kty": "OKP",
 *           "kid": "BnbnQW5VWoys6x6qYxEUVrEKGYW2GS5vG71vCMwwfsYm",
 *           "crv": "Ed25519",
 *           "x": "oENVsxOUiH54X8wJLaVkicCRk00wBIQ4sRgbk54N8Mo"
 *         }
 *       },
 *       "iss": "did:key:z6MktqtXNG8CDUY9PrrtoStFzeCnhpMmgxYL1gikcW3BzvNW",
 *       "iat": 1698151532,
 *       "_sd": [
 *         "1oLbHVhfmVs2oA3vhFNTXhMw4lGu7ql9dZ0T7p-vWqE",
 *         "2xuzS3kUrT6VPJD-MySIkQ47HIB-gcyzF5NDY19cPBw",
 *         "hn1gcrO_Q2HskW2Z_nzIrIl6KpgqldvScozutJdbhWM",
 *         "jc73t3yBoDs_pDYb03lEYKYvCbtCq9NhuJ6_5A7QNSs",
 *         "lKI_sY05pDIs9MDrjCO4v8XoDM963JXxrp9T2FNLyTY",
 *         "sl0hkY5LeVwy3rIjNaCl4P4CJ3C3v8Ip-GH2lB9Sd_A"
 *       ],
 *       "_sd_alg": "sha-256"
 *     },
 *     "signature": "osvw_Favqx8KtupHNr_Rk-zR8iOIav0fQ5Lf_F1v1n1LjVtx-_CkNFSujUnkNfo5HPiQRsvyu5ab0UX6Z7vpCw"
 *   },
 *   "disclosures": [
 *     {
 *       "_digest": "2xuzS3kUrT6VPJD-MySIkQ47HIB-gcyzF5NDY19cPBw",
 *       "_encoded": "WyJjMkZzZEEiLCJpc19vdmVyXzY1Iix0cnVlXQ",
 *       "salt": "c2FsdA",
 *       "key": "is_over_65",
 *       "value": true
 *     },
 *     {
 *       "_digest": "jc73t3yBoDs_pDYb03lEYKYvCbtCq9NhuJ6_5A7QNSs",
 *       "_encoded": "WyJjMkZzZEEiLCJpc19vdmVyXzIxIix0cnVlXQ",
 *       "salt": "c2FsdA",
 *       "key": "is_over_21",
 *       "value": true
 *     },
 *     {
 *       "_digest": "sl0hkY5LeVwy3rIjNaCl4P4CJ3C3v8Ip-GH2lB9Sd_A",
 *       "_encoded": "WyJjMkZzZEEiLCJlbWFpbCIsImpvaG5kb2VAZXhhbXBsZS5jb20iXQ",
 *       "salt": "c2FsdA",
 *       "key": "email",
 *       "value": "johndoe@example.com"
 *     },
 *     {
 *       "_digest": "8Kl-6KGl7JjFrlN0ZKDPKzeRfo0oJ5Tv0F6cXgpmOCY",
 *       "_encoded": "WyJjMkZzZEEiLCJjb3VudHJ5IiwiVVMiXQ",
 *       "salt": "c2FsdA",
 *       "key": "country",
 *       "value": "US"
 *     },
 *     {
 *       "_digest": "1oLbHVhfmVs2oA3vhFNTXhMw4lGu7ql9dZ0T7p-vWqE",
 *       "_encoded": "WyJjMkZzZEEiLCJnaXZlbl9uYW1lIiwiSm9obiJd",
 *       "salt": "c2FsdA",
 *       "key": "given_name",
 *       "value": "John"
 *     }
 *   ],
 *   "kbJwt": {
 *     "header": {
 *       "typ": "kb+jwt",
 *       "alg": "EdDSA"
 *     },
 *     "payload": {
 *       "iat": 1698151532,
 *       "nonce": "salt",
 *       "aud": "did:key:zUC74VEqqhEHQcgv4zagSPkqFJxuNWuoBPKjJuHETEUeHLoSqWt92viSsmaWjy82y",
 *       "sd_hash": "isaV9zbezncMcswuJxONHEZbb3wsIVD97QuCN_AqeZ4"
 *     },
 *     "signature": "eI-fj0vqX6WPGic-q5XYm4m6CyNIOCJ4301IislyFgXuh899HekOKfc0osTVoBe-TstbaI_NCu2rRix4NF8IBw"
 *   }
 * }
 */
export const complexSdJwtVcPresentationWithCnfJwkKid =
  'eyJ0eXAiOiJ2YytzZC1qd3QiLCJhbGciOiJFZERTQSIsImtpZCI6IiN6Nk1rdHF0WE5HOENEVVk5UHJydG9TdEZ6ZUNuaHBNbWd4WUwxZ2lrY1czQnp2TlcifQ.eyJ2Y3QiOiJJZGVudGl0eUNyZWRlbnRpYWwiLCJmYW1pbHlfbmFtZSI6IkRvZSIsInBob25lX251bWJlciI6IisxLTIwMi01NTUtMDEwMSIsImFkZHJlc3MiOnsic3RyZWV0X2FkZHJlc3MiOiIxMjMgTWFpbiBTdCIsImxvY2FsaXR5IjoiQW55dG93biIsIl9zZCI6WyI4S2wtNktHbDdKakZybE4wWktEUEt6ZVJmbzBvSjVUdjBGNmNYZ3BtT0NZIiwiY3hINmc1MUJPaDh2RGlRWFc4OEtxODk2REVWTFpaNG1idUxPNnpfXzVkcyJdfSwiY25mIjp7Imp3ayI6eyJrdHkiOiJPS1AiLCJraWQiOiJCbmJuUVc1VldveXM2eDZxWXhFVVZyRUtHWVcyR1M1dkc3MXZDTXd3ZnNZbSIsImNydiI6IkVkMjU1MTkiLCJ4Ijoib0VOVnN4T1VpSDU0WDh3SkxhVmtpY0NSazAwd0JJUTRzUmdiazU0TjhNbyJ9fSwiaXNzIjoiZGlkOmtleTp6Nk1rdHF0WE5HOENEVVk5UHJydG9TdEZ6ZUNuaHBNbWd4WUwxZ2lrY1czQnp2TlciLCJpYXQiOjE2OTgxNTE1MzIsIl9zZCI6WyIxb0xiSFZoZm1WczJvQTN2aEZOVFhoTXc0bEd1N3FsOWRaMFQ3cC12V3FFIiwiMnh1elMza1VyVDZWUEpELU15U0lrUTQ3SElCLWdjeXpGNU5EWTE5Y1BCdyIsImhuMWdjck9fUTJIc2tXMlpfbnpJcklsNktwZ3FsZHZTY296dXRKZGJoV00iLCJqYzczdDN5Qm9Ec19wRFliMDNsRVlLWXZDYnRDcTlOaHVKNl81QTdRTlNzIiwibEtJX3NZMDVwRElzOU1EcmpDTzR2OFhvRE05NjNKWHhycDlUMkZOTHlUWSIsInNsMGhrWTVMZVZ3eTNySWpOYUNsNFA0Q0ozQzN2OElwLUdIMmxCOVNkX0EiXSwiX3NkX2FsZyI6InNoYS0yNTYifQ.osvw_Favqx8KtupHNr_Rk-zR8iOIav0fQ5Lf_F1v1n1LjVtx-_CkNFSujUnkNfo5HPiQRsvyu5ab0UX6Z7vpCw~WyJjMkZzZEEiLCJpc19vdmVyXzY1Iix0cnVlXQ~WyJjMkZzZEEiLCJpc19vdmVyXzIxIix0cnVlXQ~WyJjMkZzZEEiLCJlbWFpbCIsImpvaG5kb2VAZXhhbXBsZS5jb20iXQ~WyJjMkZzZEEiLCJjb3VudHJ5IiwiVVMiXQ~WyJjMkZzZEEiLCJnaXZlbl9uYW1lIiwiSm9obiJd~eyJ0eXAiOiJrYitqd3QiLCJhbGciOiJFZERTQSJ9.eyJpYXQiOjE2OTgxNTE1MzIsIm5vbmNlIjoic2FsdCIsImF1ZCI6ImRpZDprZXk6elVDNzRWRXFxaEVIUWNndjR6YWdTUGtxRkp4dU5XdW9CUEtqSnVIRVRFVWVITG9TcVd0OTJ2aVNzbWFXank4MnkiLCJzZF9oYXNoIjoiaXNhVjl6YmV6bmNNY3N3dUp4T05IRVpiYjN3c0lWRDk3UXVDTl9BcWVaNCJ9.eI-fj0vqX6WPGic-q5XYm4m6CyNIOCJ4301IislyFgXuh899HekOKfc0osTVoBe-TstbaI_NCu2rRix4NF8IBw'
