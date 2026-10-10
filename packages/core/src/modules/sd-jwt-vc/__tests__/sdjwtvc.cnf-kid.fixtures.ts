/** sdJwtVcWithCnfKid
 * {
 *   "jwt": {
 *     "header": {
 *       "typ": "dc+sd-jwt",
 *       "alg": "EdDSA",
 *       "kid": "#z6MktqtXNG8CDUY9PrrtoStFzeCnhpMmgxYL1gikcW3BzvNW"
 *     },
 *     "payload": {
 *       "vct": "IdentityCredential",
 *       "cnf": {
 *         "kid": "did:key:z6MkqErpzkKvrMULDSwYEXCKLwnK67msgKLGx7vr2duxb6L9#z6MkqErpzkKvrMULDSwYEXCKLwnK67msgKLGx7vr2duxb6L9"
 *       },
 *       "iss": "did:key:z6MktqtXNG8CDUY9PrrtoStFzeCnhpMmgxYL1gikcW3BzvNW",
 *       "iat": 1698151532,
 *       "_sd": [
 *         "LHLZVlumA3_k-zntrSL6ocULVh_uz0PQoupZS4hu15M"
 *       ],
 *       "_sd_alg": "sha-256"
 *     },
 *     "signature": "Mo0cumo2aDyNgZNxhehQOlzVi8romJ-74Jz2GDQEYTOJC_WhVq8WkXjieYTSSKrlXXQ7InyqD63qZyu43iKsCA"
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
export const sdJwtVcWithCnfKid =
  'eyJ0eXAiOiJkYytzZC1qd3QiLCJhbGciOiJFZERTQSIsImtpZCI6IiN6Nk1rdHF0WE5HOENEVVk5UHJydG9TdEZ6ZUNuaHBNbWd4WUwxZ2lrY1czQnp2TlcifQ.eyJ2Y3QiOiJJZGVudGl0eUNyZWRlbnRpYWwiLCJjbmYiOnsia2lkIjoiZGlkOmtleTp6Nk1rcUVycHprS3ZyTVVMRFN3WUVYQ0tMd25LNjdtc2dLTEd4N3ZyMmR1eGI2TDkjejZNa3FFcnB6a0t2ck1VTERTd1lFWENLTHduSzY3bXNnS0xHeDd2cjJkdXhiNkw5In0sImlzcyI6ImRpZDprZXk6ejZNa3RxdFhORzhDRFVZOVBycnRvU3RGemVDbmhwTW1neFlMMWdpa2NXM0J6dk5XIiwiaWF0IjoxNjk4MTUxNTMyLCJfc2QiOlsiTEhMWlZsdW1BM19rLXpudHJTTDZvY1VMVmhfdXowUFFvdXBaUzRodTE1TSJdLCJfc2RfYWxnIjoic2hhLTI1NiJ9.Mo0cumo2aDyNgZNxhehQOlzVi8romJ-74Jz2GDQEYTOJC_WhVq8WkXjieYTSSKrlXXQ7InyqD63qZyu43iKsCA~WyJjMkZzZEEiLCJjbGFpbSIsInNvbWUtY2xhaW0iXQ~'

/** sdJwtVcPresentationWithCnfKid
 * {
 *   "jwt": {
 *     "header": {
 *       "typ": "dc+sd-jwt",
 *       "alg": "EdDSA",
 *       "kid": "#z6MktqtXNG8CDUY9PrrtoStFzeCnhpMmgxYL1gikcW3BzvNW"
 *     },
 *     "payload": {
 *       "vct": "IdentityCredential",
 *       "cnf": {
 *         "kid": "did:key:z6MkqErpzkKvrMULDSwYEXCKLwnK67msgKLGx7vr2duxb6L9#z6MkqErpzkKvrMULDSwYEXCKLwnK67msgKLGx7vr2duxb6L9"
 *       },
 *       "iss": "did:key:z6MktqtXNG8CDUY9PrrtoStFzeCnhpMmgxYL1gikcW3BzvNW",
 *       "iat": 1698151532,
 *       "_sd": [
 *         "LHLZVlumA3_k-zntrSL6ocULVh_uz0PQoupZS4hu15M"
 *       ],
 *       "_sd_alg": "sha-256"
 *     },
 *     "signature": "Mo0cumo2aDyNgZNxhehQOlzVi8romJ-74Jz2GDQEYTOJC_WhVq8WkXjieYTSSKrlXXQ7InyqD63qZyu43iKsCA"
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
 *       "nonce": "did-holder-kid",
 *       "aud": "verifier",
 *       "sd_hash": "l7-BH5MR6XUgO2Nd2d4qQl1mjPAF_U13nCjl3OZcKIg"
 *     },
 *     "signature": "xSV1dMthVblmhlQt-NAbR7UE4Lpp7qKMp3MPn_Gag_sFOz_nvrE8a9fZk3Rtk7uTporF7hjbwfI9eUyUEGF5CQ"
 *   }
 * }
 */
export const sdJwtVcPresentationWithCnfKid =
  'eyJ0eXAiOiJkYytzZC1qd3QiLCJhbGciOiJFZERTQSIsImtpZCI6IiN6Nk1rdHF0WE5HOENEVVk5UHJydG9TdEZ6ZUNuaHBNbWd4WUwxZ2lrY1czQnp2TlcifQ.eyJ2Y3QiOiJJZGVudGl0eUNyZWRlbnRpYWwiLCJjbmYiOnsia2lkIjoiZGlkOmtleTp6Nk1rcUVycHprS3ZyTVVMRFN3WUVYQ0tMd25LNjdtc2dLTEd4N3ZyMmR1eGI2TDkjejZNa3FFcnB6a0t2ck1VTERTd1lFWENLTHduSzY3bXNnS0xHeDd2cjJkdXhiNkw5In0sImlzcyI6ImRpZDprZXk6ejZNa3RxdFhORzhDRFVZOVBycnRvU3RGemVDbmhwTW1neFlMMWdpa2NXM0J6dk5XIiwiaWF0IjoxNjk4MTUxNTMyLCJfc2QiOlsiTEhMWlZsdW1BM19rLXpudHJTTDZvY1VMVmhfdXowUFFvdXBaUzRodTE1TSJdLCJfc2RfYWxnIjoic2hhLTI1NiJ9.Mo0cumo2aDyNgZNxhehQOlzVi8romJ-74Jz2GDQEYTOJC_WhVq8WkXjieYTSSKrlXXQ7InyqD63qZyu43iKsCA~WyJjMkZzZEEiLCJjbGFpbSIsInNvbWUtY2xhaW0iXQ~eyJ0eXAiOiJrYitqd3QiLCJhbGciOiJFZERTQSJ9.eyJpYXQiOjE2OTgxNTE1MzIsIm5vbmNlIjoiZGlkLWhvbGRlci1raWQiLCJhdWQiOiJ2ZXJpZmllciIsInNkX2hhc2giOiJsNy1CSDVNUjZYVWdPMk5kMmQ0cVFsMW1qUEFGX1UxM25DamwzT1pjS0lnIn0.xSV1dMthVblmhlQt-NAbR7UE4Lpp7qKMp3MPn_Gag_sFOz_nvrE8a9fZk3Rtk7uTporF7hjbwfI9eUyUEGF5CQ'
