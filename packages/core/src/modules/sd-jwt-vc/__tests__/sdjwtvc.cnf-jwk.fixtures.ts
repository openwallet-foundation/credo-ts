// Credentials with cnf.jwk containing only public key members.

/** simpleX509PublicJwk
 * {
 *   "jwt": {
 *     "header": {
 *       "typ": "vc+sd-jwt",
 *       "alg": "EdDSA",
 *       "x5c": [
 *         "MIHeMIGRoAMCAQICEB0ao4eUAeHkB86w8fIEnGcwBQYDK2VwMAAwHhcNMjQwNzE2MTMzNTE3WhcNMjQxMDIzMTI0NTMyWjAAMCowBQYDK2VwAyEA1c+kP0tYhvSv/2Bw7oJQbCWYObTcB2KUOTpw+LtLo9ujITAfMB0GA1UdEQQWMBSGEmh0dHBzOi8vaXNzdWVyLmNvbTAFBgMrZXADQQBE4Jakm8vn255B8dAgygbhR0ZPSfCEngFuiWDBdyAXjW6ahit6m8ilem908kxk2yJNghTISBlDhwkfrlyPRx4M"
 *       ]
 *     },
 *     "payload": {
 *       "claim": "some-claim",
 *       "vct": "IdentityCredential",
 *       "cnf": {
 *         "jwk": {
 *           "crv": "Ed25519",
 *           "kty": "OKP",
 *           "x": "oENVsxOUiH54X8wJLaVkicCRk00wBIQ4sRgbk54N8Mo"
 *         }
 *       },
 *       "iss": "https://issuer.com",
 *       "iat": 1698151532
 *     },
 *     "signature": "y88XB5he6lLFKDyBNqnGT_hG8p96WYgT-yjbiToSPSV4FqcniQ3ZAzfdNxmBh_5QjnqvBPGg-BeNcwuQIBXFAQ"
 *   },
 *   "disclosures": []
 * }
 */
export const simpleX509PublicJwk =
  'eyJ0eXAiOiJ2YytzZC1qd3QiLCJhbGciOiJFZERTQSIsIng1YyI6WyJNSUhlTUlHUm9BTUNBUUlDRUIwYW80ZVVBZUhrQjg2dzhmSUVuR2N3QlFZREsyVndNQUF3SGhjTk1qUXdOekUyTVRNek5URTNXaGNOTWpReE1ESXpNVEkwTlRNeVdqQUFNQ293QlFZREsyVndBeUVBMWMra1AwdFlodlN2LzJCdzdvSlFiQ1dZT2JUY0IyS1VPVHB3K0x0TG85dWpJVEFmTUIwR0ExVWRFUVFXTUJTR0VtaDBkSEJ6T2k4dmFYTnpkV1Z5TG1OdmJUQUZCZ01yWlhBRFFRQkU0SmFrbTh2bjI1NUI4ZEFneWdiaFIwWlBTZkNFbmdGdWlXREJkeUFYalc2YWhpdDZtOGlsZW05MDhreGsyeUpOZ2hUSVNCbERod2tmcmx5UFJ4NE0iXX0.eyJjbGFpbSI6InNvbWUtY2xhaW0iLCJ2Y3QiOiJJZGVudGl0eUNyZWRlbnRpYWwiLCJjbmYiOnsiandrIjp7ImNydiI6IkVkMjU1MTkiLCJrdHkiOiJPS1AiLCJ4Ijoib0VOVnN4T1VpSDU0WDh3SkxhVmtpY0NSazAwd0JJUTRzUmdiazU0TjhNbyJ9fSwiaXNzIjoiaHR0cHM6Ly9pc3N1ZXIuY29tIiwiaWF0IjoxNjk4MTUxNTMyfQ.y88XB5he6lLFKDyBNqnGT_hG8p96WYgT-yjbiToSPSV4FqcniQ3ZAzfdNxmBh_5QjnqvBPGg-BeNcwuQIBXFAQ~'

/** simpleX509WithoutIssPublicJwk
 * {
 *   "jwt": {
 *     "header": {
 *       "typ": "dc+sd-jwt",
 *       "alg": "EdDSA",
 *       "x5c": [
 *         "MIHeMIGRoAMCAQICEB0ao4eUAeHkB86w8fIEnGcwBQYDK2VwMAAwHhcNMjQwNzE2MTMzNTE3WhcNMjQxMDIzMTI0NTMyWjAAMCowBQYDK2VwAyEA1c+kP0tYhvSv/2Bw7oJQbCWYObTcB2KUOTpw+LtLo9ujITAfMB0GA1UdEQQWMBSGEmh0dHBzOi8vaXNzdWVyLmNvbTAFBgMrZXADQQBE4Jakm8vn255B8dAgygbhR0ZPSfCEngFuiWDBdyAXjW6ahit6m8ilem908kxk2yJNghTISBlDhwkfrlyPRx4M"
 *       ]
 *     },
 *     "payload": {
 *       "claim": "some-claim",
 *       "vct": "IdentityCredential",
 *       "cnf": {
 *         "jwk": {
 *           "crv": "Ed25519",
 *           "kty": "OKP",
 *           "x": "oENVsxOUiH54X8wJLaVkicCRk00wBIQ4sRgbk54N8Mo"
 *         }
 *       },
 *       "iat": 1698151532
 *     },
 *     "signature": "ygsM3gb6tANvAxn6Ht14fCg7YMMgPF636KZUtLDbsCqE-BBbPErysuz07n-WxXq9baI-hS5bvDdsbN2OHLnIDw"
 *   },
 *   "disclosures": []
 * }
 */
export const simpleX509WithoutIssPublicJwk =
  'eyJ0eXAiOiJkYytzZC1qd3QiLCJhbGciOiJFZERTQSIsIng1YyI6WyJNSUhlTUlHUm9BTUNBUUlDRUIwYW80ZVVBZUhrQjg2dzhmSUVuR2N3QlFZREsyVndNQUF3SGhjTk1qUXdOekUyTVRNek5URTNXaGNOTWpReE1ESXpNVEkwTlRNeVdqQUFNQ293QlFZREsyVndBeUVBMWMra1AwdFlodlN2LzJCdzdvSlFiQ1dZT2JUY0IyS1VPVHB3K0x0TG85dWpJVEFmTUIwR0ExVWRFUVFXTUJTR0VtaDBkSEJ6T2k4dmFYTnpkV1Z5TG1OdmJUQUZCZ01yWlhBRFFRQkU0SmFrbTh2bjI1NUI4ZEFneWdiaFIwWlBTZkNFbmdGdWlXREJkeUFYalc2YWhpdDZtOGlsZW05MDhreGsyeUpOZ2hUSVNCbERod2tmcmx5UFJ4NE0iXX0.eyJjbGFpbSI6InNvbWUtY2xhaW0iLCJ2Y3QiOiJJZGVudGl0eUNyZWRlbnRpYWwiLCJjbmYiOnsiandrIjp7ImNydiI6IkVkMjU1MTkiLCJrdHkiOiJPS1AiLCJ4Ijoib0VOVnN4T1VpSDU0WDh3SkxhVmtpY0NSazAwd0JJUTRzUmdiazU0TjhNbyJ9fSwiaWF0IjoxNjk4MTUxNTMyfQ.ygsM3gb6tANvAxn6Ht14fCg7YMMgPF636KZUtLDbsCqE-BBbPErysuz07n-WxXq9baI-hS5bvDdsbN2OHLnIDw~'

/** simpleJwtVc
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
 *           "crv": "Ed25519",
 *           "kty": "OKP",
 *           "x": "oENVsxOUiH54X8wJLaVkicCRk00wBIQ4sRgbk54N8Mo"
 *         }
 *       },
 *       "iss": "did:key:z6MktqtXNG8CDUY9PrrtoStFzeCnhpMmgxYL1gikcW3BzvNW",
 *       "iat": 1698151532
 *     },
 *     "signature": "BGm9FUj2UYEL-8GWd9UAgwR-xwIyGyjwo_ogPuf51Rz6C7a_ZQaA37oykGFvO1HQFG0x2M7CsBeNFQ4qRfJgAA"
 *   },
 *   "disclosures": []
 * }
 */
export const simpleJwtVc =
  'eyJ0eXAiOiJ2YytzZC1qd3QiLCJhbGciOiJFZERTQSIsImtpZCI6IiN6Nk1rdHF0WE5HOENEVVk5UHJydG9TdEZ6ZUNuaHBNbWd4WUwxZ2lrY1czQnp2TlcifQ.eyJjbGFpbSI6InNvbWUtY2xhaW0iLCJ2Y3QiOiJJZGVudGl0eUNyZWRlbnRpYWwiLCJjbmYiOnsiandrIjp7ImNydiI6IkVkMjU1MTkiLCJrdHkiOiJPS1AiLCJ4Ijoib0VOVnN4T1VpSDU0WDh3SkxhVmtpY0NSazAwd0JJUTRzUmdiazU0TjhNbyJ9fSwiaXNzIjoiZGlkOmtleTp6Nk1rdHF0WE5HOENEVVk5UHJydG9TdEZ6ZUNuaHBNbWd4WUwxZ2lrY1czQnp2TlciLCJpYXQiOjE2OTgxNTE1MzJ9.BGm9FUj2UYEL-8GWd9UAgwR-xwIyGyjwo_ogPuf51Rz6C7a_ZQaA37oykGFvO1HQFG0x2M7CsBeNFQ4qRfJgAA~'

/** sdJwtVcWithSingleDisclosure
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
 *           "crv": "Ed25519",
 *           "kty": "OKP",
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
 *     "signature": "BSjRCjKkAnTXckLb40FWZQiLMND1BZ1Seit8DbFqBf8cwEfaW6kpBym5LL6eATWlC4nuq--DDbBueLpU7IMYAg"
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
export const sdJwtVcWithSingleDisclosure =
  'eyJ0eXAiOiJ2YytzZC1qd3QiLCJhbGciOiJFZERTQSIsImtpZCI6IiN6Nk1rdHF0WE5HOENEVVk5UHJydG9TdEZ6ZUNuaHBNbWd4WUwxZ2lrY1czQnp2TlcifQ.eyJ2Y3QiOiJJZGVudGl0eUNyZWRlbnRpYWwiLCJjbmYiOnsiandrIjp7ImNydiI6IkVkMjU1MTkiLCJrdHkiOiJPS1AiLCJ4Ijoib0VOVnN4T1VpSDU0WDh3SkxhVmtpY0NSazAwd0JJUTRzUmdiazU0TjhNbyJ9fSwiaXNzIjoiZGlkOmtleTp6Nk1rdHF0WE5HOENEVVk5UHJydG9TdEZ6ZUNuaHBNbWd4WUwxZ2lrY1czQnp2TlciLCJpYXQiOjE2OTgxNTE1MzIsIl9zZCI6WyJMSExaVmx1bUEzX2stem50clNMNm9jVUxWaF91ejBQUW91cFpTNGh1MTVNIl0sIl9zZF9hbGciOiJzaGEtMjU2In0.BSjRCjKkAnTXckLb40FWZQiLMND1BZ1Seit8DbFqBf8cwEfaW6kpBym5LL6eATWlC4nuq--DDbBueLpU7IMYAg~WyJjMkZzZEEiLCJjbGFpbSIsInNvbWUtY2xhaW0iXQ~'

/** complexSdJwtVc
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
 *     "signature": "WlUy31-0NZzQlhgDcBYMovSZk5xtq-TznU-6MH6VqIFaSqIc4WQH3rPgAbZggdL12aqKYaIKwSSZcfRnQ1F_CA"
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
export const complexSdJwtVc =
  'eyJ0eXAiOiJ2YytzZC1qd3QiLCJhbGciOiJFZERTQSIsImtpZCI6IiN6Nk1rdHF0WE5HOENEVVk5UHJydG9TdEZ6ZUNuaHBNbWd4WUwxZ2lrY1czQnp2TlcifQ.eyJ2Y3QiOiJJZGVudGl0eUNyZWRlbnRpYWwiLCJmYW1pbHlfbmFtZSI6IkRvZSIsInBob25lX251bWJlciI6IisxLTIwMi01NTUtMDEwMSIsImFkZHJlc3MiOnsic3RyZWV0X2FkZHJlc3MiOiIxMjMgTWFpbiBTdCIsImxvY2FsaXR5IjoiQW55dG93biIsIl9zZCI6WyI4S2wtNktHbDdKakZybE4wWktEUEt6ZVJmbzBvSjVUdjBGNmNYZ3BtT0NZIiwiY3hINmc1MUJPaDh2RGlRWFc4OEtxODk2REVWTFpaNG1idUxPNnpfXzVkcyJdfSwiY25mIjp7Imp3ayI6eyJrdHkiOiJPS1AiLCJjcnYiOiJFZDI1NTE5IiwieCI6Im9FTlZzeE9VaUg1NFg4d0pMYVZraWNDUmswMHdCSVE0c1JnYms1NE44TW8ifX0sImlzcyI6ImRpZDprZXk6ejZNa3RxdFhORzhDRFVZOVBycnRvU3RGemVDbmhwTW1neFlMMWdpa2NXM0J6dk5XIiwiaWF0IjoxNjk4MTUxNTMyLCJfc2QiOlsiMW9MYkhWaGZtVnMyb0EzdmhGTlRYaE13NGxHdTdxbDlkWjBUN3AtdldxRSIsIjJ4dXpTM2tVclQ2VlBKRC1NeVNJa1E0N0hJQi1nY3l6RjVORFkxOWNQQnciLCJobjFnY3JPX1EySHNrVzJaX256SXJJbDZLcGdxbGR2U2NvenV0SmRiaFdNIiwiamM3M3QzeUJvRHNfcERZYjAzbEVZS1l2Q2J0Q3E5Tmh1SjZfNUE3UU5TcyIsImxLSV9zWTA1cERJczlNRHJqQ080djhYb0RNOTYzSlh4cnA5VDJGTkx5VFkiLCJzbDBoa1k1TGVWd3kzcklqTmFDbDRQNENKM0MzdjhJcC1HSDJsQjlTZF9BIl0sIl9zZF9hbGciOiJzaGEtMjU2In0.WlUy31-0NZzQlhgDcBYMovSZk5xtq-TznU-6MH6VqIFaSqIc4WQH3rPgAbZggdL12aqKYaIKwSSZcfRnQ1F_CA~WyJjMkZzZEEiLCJyZWdpb24iLCJBbnlzdGF0ZSJd~WyJjMkZzZEEiLCJjb3VudHJ5IiwiVVMiXQ~WyJjMkZzZEEiLCJnaXZlbl9uYW1lIiwiSm9obiJd~WyJjMkZzZEEiLCJlbWFpbCIsImpvaG5kb2VAZXhhbXBsZS5jb20iXQ~WyJjMkZzZEEiLCJiaXJ0aGRhdGUiLCIxOTQwLTAxLTAxIl0~WyJjMkZzZEEiLCJpc19vdmVyXzE4Iix0cnVlXQ~WyJjMkZzZEEiLCJpc19vdmVyXzIxIix0cnVlXQ~WyJjMkZzZEEiLCJpc19vdmVyXzY1Iix0cnVlXQ~'

/** simpleJwtVcPresentation
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
 *           "crv": "Ed25519",
 *           "kty": "OKP",
 *           "x": "oENVsxOUiH54X8wJLaVkicCRk00wBIQ4sRgbk54N8Mo"
 *         }
 *       },
 *       "iss": "did:key:z6MktqtXNG8CDUY9PrrtoStFzeCnhpMmgxYL1gikcW3BzvNW",
 *       "iat": 1698151532
 *     },
 *     "signature": "BGm9FUj2UYEL-8GWd9UAgwR-xwIyGyjwo_ogPuf51Rz6C7a_ZQaA37oykGFvO1HQFG0x2M7CsBeNFQ4qRfJgAA"
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
 *       "sd_hash": "QCGgIopRVzPdvHGRaFO1OZTwU8X_hzKrSL19DJflLSA"
 *     },
 *     "signature": "NealxUHP8HO4sF4NxmS6x4hAMXGxPJPGM5hxLWdvcYFzh9dwF9UaXatqOAXWqNByET1j6S_UFZ8GtdevSZPmAw"
 *   }
 * }
 */
export const simpleJwtVcPresentation =
  'eyJ0eXAiOiJ2YytzZC1qd3QiLCJhbGciOiJFZERTQSIsImtpZCI6IiN6Nk1rdHF0WE5HOENEVVk5UHJydG9TdEZ6ZUNuaHBNbWd4WUwxZ2lrY1czQnp2TlcifQ.eyJjbGFpbSI6InNvbWUtY2xhaW0iLCJ2Y3QiOiJJZGVudGl0eUNyZWRlbnRpYWwiLCJjbmYiOnsiandrIjp7ImNydiI6IkVkMjU1MTkiLCJrdHkiOiJPS1AiLCJ4Ijoib0VOVnN4T1VpSDU0WDh3SkxhVmtpY0NSazAwd0JJUTRzUmdiazU0TjhNbyJ9fSwiaXNzIjoiZGlkOmtleTp6Nk1rdHF0WE5HOENEVVk5UHJydG9TdEZ6ZUNuaHBNbWd4WUwxZ2lrY1czQnp2TlciLCJpYXQiOjE2OTgxNTE1MzJ9.BGm9FUj2UYEL-8GWd9UAgwR-xwIyGyjwo_ogPuf51Rz6C7a_ZQaA37oykGFvO1HQFG0x2M7CsBeNFQ4qRfJgAA~eyJ0eXAiOiJrYitqd3QiLCJhbGciOiJFZERTQSJ9.eyJpYXQiOjE2OTgxNTE1MzIsIm5vbmNlIjoic2FsdCIsImF1ZCI6ImRpZDprZXk6elVDNzRWRXFxaEVIUWNndjR6YWdTUGtxRkp4dU5XdW9CUEtqSnVIRVRFVWVITG9TcVd0OTJ2aVNzbWFXank4MnkiLCJzZF9oYXNoIjoiUUNHZ0lvcFJWelBkdkhHUmFGTzFPWlR3VThYX2h6S3JTTDE5REpmbExTQSJ9.NealxUHP8HO4sF4NxmS6x4hAMXGxPJPGM5hxLWdvcYFzh9dwF9UaXatqOAXWqNByET1j6S_UFZ8GtdevSZPmAw'

/** sdJwtVcWithSingleDisclosurePresentation
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
 *           "crv": "Ed25519",
 *           "kty": "OKP",
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
 *     "signature": "BSjRCjKkAnTXckLb40FWZQiLMND1BZ1Seit8DbFqBf8cwEfaW6kpBym5LL6eATWlC4nuq--DDbBueLpU7IMYAg"
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
 *       "sd_hash": "U3iXZz7-pWx3qzMMKwhz7tXodFXhX5PfbJuB1c4fv0k"
 *     },
 *     "signature": "Nd89oVVpxJnWoHVU_lUEwTj_FsnU-n_AKGqcbVSgQKhvU18vRzLmugv6R8GrvQysb82Pvt6CLO0_cInWhv2nCA"
 *   }
 * }
 */
export const sdJwtVcWithSingleDisclosurePresentation =
  'eyJ0eXAiOiJ2YytzZC1qd3QiLCJhbGciOiJFZERTQSIsImtpZCI6IiN6Nk1rdHF0WE5HOENEVVk5UHJydG9TdEZ6ZUNuaHBNbWd4WUwxZ2lrY1czQnp2TlcifQ.eyJ2Y3QiOiJJZGVudGl0eUNyZWRlbnRpYWwiLCJjbmYiOnsiandrIjp7ImNydiI6IkVkMjU1MTkiLCJrdHkiOiJPS1AiLCJ4Ijoib0VOVnN4T1VpSDU0WDh3SkxhVmtpY0NSazAwd0JJUTRzUmdiazU0TjhNbyJ9fSwiaXNzIjoiZGlkOmtleTp6Nk1rdHF0WE5HOENEVVk5UHJydG9TdEZ6ZUNuaHBNbWd4WUwxZ2lrY1czQnp2TlciLCJpYXQiOjE2OTgxNTE1MzIsIl9zZCI6WyJMSExaVmx1bUEzX2stem50clNMNm9jVUxWaF91ejBQUW91cFpTNGh1MTVNIl0sIl9zZF9hbGciOiJzaGEtMjU2In0.BSjRCjKkAnTXckLb40FWZQiLMND1BZ1Seit8DbFqBf8cwEfaW6kpBym5LL6eATWlC4nuq--DDbBueLpU7IMYAg~WyJjMkZzZEEiLCJjbGFpbSIsInNvbWUtY2xhaW0iXQ~eyJ0eXAiOiJrYitqd3QiLCJhbGciOiJFZERTQSJ9.eyJpYXQiOjE2OTgxNTE1MzIsIm5vbmNlIjoic2FsdCIsImF1ZCI6ImRpZDprZXk6elVDNzRWRXFxaEVIUWNndjR6YWdTUGtxRkp4dU5XdW9CUEtqSnVIRVRFVWVITG9TcVd0OTJ2aVNzbWFXank4MnkiLCJzZF9oYXNoIjoiVTNpWFp6Ny1wV3gzcXpNTUt3aHo3dFhvZEZYaFg1UGZiSnVCMWM0ZnYwayJ9.Nd89oVVpxJnWoHVU_lUEwTj_FsnU-n_AKGqcbVSgQKhvU18vRzLmugv6R8GrvQysb82Pvt6CLO0_cInWhv2nCA'

/** complexSdJwtVcPresentation
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
 *     "signature": "WlUy31-0NZzQlhgDcBYMovSZk5xtq-TznU-6MH6VqIFaSqIc4WQH3rPgAbZggdL12aqKYaIKwSSZcfRnQ1F_CA"
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
 *       "sd_hash": "HMAOOt0QXj2BjAWkG3YvPeSAm7iHb2n5PBJV-amw71U"
 *     },
 *     "signature": "mUDtAMAndkeQb_J9mPl_sh0B_QGy2dUtIElB3TmdyLQeeapUEHKvQQdIZujktEjwiz8oZyX2o7o1EU0p3K56BA"
 *   }
 * }
 */
export const complexSdJwtVcPresentation =
  'eyJ0eXAiOiJ2YytzZC1qd3QiLCJhbGciOiJFZERTQSIsImtpZCI6IiN6Nk1rdHF0WE5HOENEVVk5UHJydG9TdEZ6ZUNuaHBNbWd4WUwxZ2lrY1czQnp2TlcifQ.eyJ2Y3QiOiJJZGVudGl0eUNyZWRlbnRpYWwiLCJmYW1pbHlfbmFtZSI6IkRvZSIsInBob25lX251bWJlciI6IisxLTIwMi01NTUtMDEwMSIsImFkZHJlc3MiOnsic3RyZWV0X2FkZHJlc3MiOiIxMjMgTWFpbiBTdCIsImxvY2FsaXR5IjoiQW55dG93biIsIl9zZCI6WyI4S2wtNktHbDdKakZybE4wWktEUEt6ZVJmbzBvSjVUdjBGNmNYZ3BtT0NZIiwiY3hINmc1MUJPaDh2RGlRWFc4OEtxODk2REVWTFpaNG1idUxPNnpfXzVkcyJdfSwiY25mIjp7Imp3ayI6eyJrdHkiOiJPS1AiLCJjcnYiOiJFZDI1NTE5IiwieCI6Im9FTlZzeE9VaUg1NFg4d0pMYVZraWNDUmswMHdCSVE0c1JnYms1NE44TW8ifX0sImlzcyI6ImRpZDprZXk6ejZNa3RxdFhORzhDRFVZOVBycnRvU3RGemVDbmhwTW1neFlMMWdpa2NXM0J6dk5XIiwiaWF0IjoxNjk4MTUxNTMyLCJfc2QiOlsiMW9MYkhWaGZtVnMyb0EzdmhGTlRYaE13NGxHdTdxbDlkWjBUN3AtdldxRSIsIjJ4dXpTM2tVclQ2VlBKRC1NeVNJa1E0N0hJQi1nY3l6RjVORFkxOWNQQnciLCJobjFnY3JPX1EySHNrVzJaX256SXJJbDZLcGdxbGR2U2NvenV0SmRiaFdNIiwiamM3M3QzeUJvRHNfcERZYjAzbEVZS1l2Q2J0Q3E5Tmh1SjZfNUE3UU5TcyIsImxLSV9zWTA1cERJczlNRHJqQ080djhYb0RNOTYzSlh4cnA5VDJGTkx5VFkiLCJzbDBoa1k1TGVWd3kzcklqTmFDbDRQNENKM0MzdjhJcC1HSDJsQjlTZF9BIl0sIl9zZF9hbGciOiJzaGEtMjU2In0.WlUy31-0NZzQlhgDcBYMovSZk5xtq-TznU-6MH6VqIFaSqIc4WQH3rPgAbZggdL12aqKYaIKwSSZcfRnQ1F_CA~WyJjMkZzZEEiLCJpc19vdmVyXzY1Iix0cnVlXQ~WyJjMkZzZEEiLCJpc19vdmVyXzIxIix0cnVlXQ~WyJjMkZzZEEiLCJlbWFpbCIsImpvaG5kb2VAZXhhbXBsZS5jb20iXQ~WyJjMkZzZEEiLCJjb3VudHJ5IiwiVVMiXQ~WyJjMkZzZEEiLCJnaXZlbl9uYW1lIiwiSm9obiJd~eyJ0eXAiOiJrYitqd3QiLCJhbGciOiJFZERTQSJ9.eyJpYXQiOjE2OTgxNTE1MzIsIm5vbmNlIjoic2FsdCIsImF1ZCI6ImRpZDprZXk6elVDNzRWRXFxaEVIUWNndjR6YWdTUGtxRkp4dU5XdW9CUEtqSnVIRVRFVWVITG9TcVd0OTJ2aVNzbWFXank4MnkiLCJzZF9oYXNoIjoiSE1BT090MFFYajJCakFXa0czWXZQZVNBbTdpSGIybjVQQkpWLWFtdzcxVSJ9.mUDtAMAndkeQb_J9mPl_sh0B_QGy2dUtIElB3TmdyLQeeapUEHKvQQdIZujktEjwiz8oZyX2o7o1EU0p3K56BA'
