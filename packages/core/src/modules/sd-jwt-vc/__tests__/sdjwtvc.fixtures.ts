/** simpleX509
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
 *           "kty": "OKP",
 *           "kid": "BnbnQW5VWoys6x6qYxEUVrEKGYW2GS5vG71vCMwwfsYm",
 *           "crv": "Ed25519",
 *           "x": "oENVsxOUiH54X8wJLaVkicCRk00wBIQ4sRgbk54N8Mo"
 *         }
 *       },
 *       "iss": "https://issuer.com",
 *       "iat": 1698151532
 *     },
 *     "signature": "7k20YP-pSYEEb3HKTea6NUCa7dtEkL4x4DR1Ajnbr6kvVwRpLZCjFn-BgSGC5ElGgeF5qLpc-MEgcvV3Xo1lBQ"
 *   },
 *   "disclosures": []
 * }
 */
export const simpleX509 = {
  sdJwtVc:
    'eyJ0eXAiOiJ2YytzZC1qd3QiLCJhbGciOiJFZERTQSIsIng1YyI6WyJNSUhlTUlHUm9BTUNBUUlDRUIwYW80ZVVBZUhrQjg2dzhmSUVuR2N3QlFZREsyVndNQUF3SGhjTk1qUXdOekUyTVRNek5URTNXaGNOTWpReE1ESXpNVEkwTlRNeVdqQUFNQ293QlFZREsyVndBeUVBMWMra1AwdFlodlN2LzJCdzdvSlFiQ1dZT2JUY0IyS1VPVHB3K0x0TG85dWpJVEFmTUIwR0ExVWRFUVFXTUJTR0VtaDBkSEJ6T2k4dmFYTnpkV1Z5TG1OdmJUQUZCZ01yWlhBRFFRQkU0SmFrbTh2bjI1NUI4ZEFneWdiaFIwWlBTZkNFbmdGdWlXREJkeUFYalc2YWhpdDZtOGlsZW05MDhreGsyeUpOZ2hUSVNCbERod2tmcmx5UFJ4NE0iXX0.eyJjbGFpbSI6InNvbWUtY2xhaW0iLCJ2Y3QiOiJJZGVudGl0eUNyZWRlbnRpYWwiLCJjbmYiOnsiandrIjp7Imt0eSI6Ik9LUCIsImtpZCI6IkJuYm5RVzVWV295czZ4NnFZeEVVVnJFS0dZVzJHUzV2RzcxdkNNd3dmc1ltIiwiY3J2IjoiRWQyNTUxOSIsIngiOiJvRU5Wc3hPVWlINTRYOHdKTGFWa2ljQ1JrMDB3QklRNHNSZ2JrNTROOE1vIn19LCJpc3MiOiJodHRwczovL2lzc3Vlci5jb20iLCJpYXQiOjE2OTgxNTE1MzJ9.7k20YP-pSYEEb3HKTea6NUCa7dtEkL4x4DR1Ajnbr6kvVwRpLZCjFn-BgSGC5ElGgeF5qLpc-MEgcvV3Xo1lBQ~',
  trustedCertificate:
    'MIHeMIGRoAMCAQICEB0ao4eUAeHkB86w8fIEnGcwBQYDK2VwMAAwHhcNMjQwNzE2MTMzNTE3WhcNMjQxMDIzMTI0NTMyWjAAMCowBQYDK2VwAyEA1c+kP0tYhvSv/2Bw7oJQbCWYObTcB2KUOTpw+LtLo9ujITAfMB0GA1UdEQQWMBSGEmh0dHBzOi8vaXNzdWVyLmNvbTAFBgMrZXADQQBE4Jakm8vn255B8dAgygbhR0ZPSfCEngFuiWDBdyAXjW6ahit6m8ilem908kxk2yJNghTISBlDhwkfrlyPRx4M',
  certificateIssuer: 'https://issuer.com',
}

/** simpleX509WithoutIss
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
 *           "kty": "OKP",
 *           "kid": "BnbnQW5VWoys6x6qYxEUVrEKGYW2GS5vG71vCMwwfsYm",
 *           "crv": "Ed25519",
 *           "x": "oENVsxOUiH54X8wJLaVkicCRk00wBIQ4sRgbk54N8Mo"
 *         }
 *       },
 *       "iat": 1698151532
 *     },
 *     "signature": "QjSi7_a7lvlcdHGp35Y4PXjzCpLb0OG4tYXlInpNv_iOM3n9Ln30IhBU6CJ5KnYA9mMbFTzW8LYmBvN8qZymDQ"
 *   },
 *   "disclosures": []
 * }
 */
export const simpleX509WithoutIss = {
  sdJwtVc:
    'eyJ0eXAiOiJkYytzZC1qd3QiLCJhbGciOiJFZERTQSIsIng1YyI6WyJNSUhlTUlHUm9BTUNBUUlDRUIwYW80ZVVBZUhrQjg2dzhmSUVuR2N3QlFZREsyVndNQUF3SGhjTk1qUXdOekUyTVRNek5URTNXaGNOTWpReE1ESXpNVEkwTlRNeVdqQUFNQ293QlFZREsyVndBeUVBMWMra1AwdFlodlN2LzJCdzdvSlFiQ1dZT2JUY0IyS1VPVHB3K0x0TG85dWpJVEFmTUIwR0ExVWRFUVFXTUJTR0VtaDBkSEJ6T2k4dmFYTnpkV1Z5TG1OdmJUQUZCZ01yWlhBRFFRQkU0SmFrbTh2bjI1NUI4ZEFneWdiaFIwWlBTZkNFbmdGdWlXREJkeUFYalc2YWhpdDZtOGlsZW05MDhreGsyeUpOZ2hUSVNCbERod2tmcmx5UFJ4NE0iXX0.eyJjbGFpbSI6InNvbWUtY2xhaW0iLCJ2Y3QiOiJJZGVudGl0eUNyZWRlbnRpYWwiLCJjbmYiOnsiandrIjp7Imt0eSI6Ik9LUCIsImtpZCI6IkJuYm5RVzVWV295czZ4NnFZeEVVVnJFS0dZVzJHUzV2RzcxdkNNd3dmc1ltIiwiY3J2IjoiRWQyNTUxOSIsIngiOiJvRU5Wc3hPVWlINTRYOHdKTGFWa2ljQ1JrMDB3QklRNHNSZ2JrNTROOE1vIn19LCJpYXQiOjE2OTgxNTE1MzJ9.QjSi7_a7lvlcdHGp35Y4PXjzCpLb0OG4tYXlInpNv_iOM3n9Ln30IhBU6CJ5KnYA9mMbFTzW8LYmBvN8qZymDQ~',
  trustedCertificate:
    'MIHeMIGRoAMCAQICEB0ao4eUAeHkB86w8fIEnGcwBQYDK2VwMAAwHhcNMjQwNzE2MTMzNTE3WhcNMjQxMDIzMTI0NTMyWjAAMCowBQYDK2VwAyEA1c+kP0tYhvSv/2Bw7oJQbCWYObTcB2KUOTpw+LtLo9ujITAfMB0GA1UdEQQWMBSGEmh0dHBzOi8vaXNzdWVyLmNvbTAFBgMrZXADQQBE4Jakm8vn255B8dAgygbhR0ZPSfCEngFuiWDBdyAXjW6ahit6m8ilem908kxk2yJNghTISBlDhwkfrlyPRx4M',
}

/** funkeX509
 * {
 *   "jwt": {
 *     "header": {
 *       "x5c": [
 *         "MIICdDCCAhugAwIBAgIBAjAKBggqhkjOPQQDAjCBiDELMAkGA1UEBhMCREUxDzANBgNVBAcMBkJlcmxpbjEdMBsGA1UECgwUQnVuZGVzZHJ1Y2tlcmVpIEdtYkgxETAPBgNVBAsMCFQgQ1MgSURFMTYwNAYDVQQDDC1TUFJJTkQgRnVua2UgRVVESSBXYWxsZXQgUHJvdG90eXBlIElzc3VpbmcgQ0EwHhcNMjQwNTMxMDgxMzE3WhcNMjUwNzA1MDgxMzE3WjBsMQswCQYDVQQGEwJERTEdMBsGA1UECgwUQnVuZGVzZHJ1Y2tlcmVpIEdtYkgxCjAIBgNVBAsMAUkxMjAwBgNVBAMMKVNQUklORCBGdW5rZSBFVURJIFdhbGxldCBQcm90b3R5cGUgSXNzdWVyMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEOFBq4YMKg4w5fTifsytwBuJf/7E7VhRPXiNm52S3q1ETIgBdXyDK3kVxGxgeHPivLP3uuMvS6iDEc7qMxmvduKOBkDCBjTAdBgNVHQ4EFgQUiPhCkLErDXPLW2/J0WVeghyw+mIwDAYDVR0TAQH/BAIwADAOBgNVHQ8BAf8EBAMCB4AwLQYDVR0RBCYwJIIiZGVtby5waWQtaXNzdWVyLmJ1bmRlc2RydWNrZXJlaS5kZTAfBgNVHSMEGDAWgBTUVhjAiTjoDliEGMl2Yr+ru8WQvjAKBggqhkjOPQQDAgNHADBEAiAbf5TzkcQzhfWoIoyi1VN7d8I9BsFKm1MWluRph2byGQIgKYkdrNf2xXPjVSbjW/U/5S5vAEC5XxcOanusOBroBbU=",
 *         "MIICeTCCAiCgAwIBAgIUB5E9QVZtmUYcDtCjKB/H3VQv72gwCgYIKoZIzj0EAwIwgYgxCzAJBgNVBAYTAkRFMQ8wDQYDVQQHDAZCZXJsaW4xHTAbBgNVBAoMFEJ1bmRlc2RydWNrZXJlaSBHbWJIMREwDwYDVQQLDAhUIENTIElERTE2MDQGA1UEAwwtU1BSSU5EIEZ1bmtlIEVVREkgV2FsbGV0IFByb3RvdHlwZSBJc3N1aW5nIENBMB4XDTI0MDUzMTA2NDgwOVoXDTM0MDUyOTA2NDgwOVowgYgxCzAJBgNVBAYTAkRFMQ8wDQYDVQQHDAZCZXJsaW4xHTAbBgNVBAoMFEJ1bmRlc2RydWNrZXJlaSBHbWJIMREwDwYDVQQLDAhUIENTIElERTE2MDQGA1UEAwwtU1BSSU5EIEZ1bmtlIEVVREkgV2FsbGV0IFByb3RvdHlwZSBJc3N1aW5nIENBMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEYGzdwFDnc7+Kn5ibAvCOM8ke77VQxqfMcwZL8IaIA+WCROcCfmY/giH92qMru5p/kyOivE0RC/IbdMONvDoUyaNmMGQwHQYDVR0OBBYEFNRWGMCJOOgOWIQYyXZiv6u7xZC+MB8GA1UdIwQYMBaAFNRWGMCJOOgOWIQYyXZiv6u7xZC+MBIGA1UdEwEB/wQIMAYBAf8CAQAwDgYDVR0PAQH/BAQDAgGGMAoGCCqGSM49BAMCA0cAMEQCIGEm7wkZKHt/atb4MdFnXW6yrnwMUT2u136gdtl10Y6hAiBuTFqvVYth1rbxzCP0xWZHmQK9kVyxn8GPfX27EIzzsw=="
 *       ],
 *       "kid": "MIGUMIGOpIGLMIGIMQswCQYDVQQGEwJERTEPMA0GA1UEBwwGQmVybGluMR0wGwYDVQQKDBRCdW5kZXNkcnVja2VyZWkgR21iSDERMA8GA1UECwwIVCBDUyBJREUxNjA0BgNVBAMMLVNQUklORCBGdW5rZSBFVURJIFdhbGxldCBQcm90b3R5cGUgSXNzdWluZyBDQQIBAg==",
 *       "typ": "vc+sd-jwt",
 *       "alg": "ES256"
 *     },
 *     "payload": {
 *       "place_of_birth": {
 *         "_sd": [
 *           "eSQx9U4R8KgJRrHIfNa7OyHSGb7Y8wlSZZG41upXSvk"
 *         ]
 *       },
 *       "_sd": [
 *         "GqeTHMmfXSr-TiXslpebu7vk-ZO0gbBw7I-mkOGi8RQ",
 *         "32ZozgHF_dTXQMVLEizwFszRyoB1VK9lsgjAGhyTvpg",
 *         "ohmcZBLMIPTa9cvpuMutsqdYuQai4bGdbnaId4Rx0Pk",
 *         "wPCI_o4-lXVW92JEBBBOk50QeHHd-aixXbs9bythnyc",
 *         "ji2wUwzEbBZaF8tm-dKiFRU6imZtm55daNfEZaoqY0s",
 *         "vNBKdJ5EijAnel1iS8daKKByMgzwrRzPsMOoPFSZBPA",
 *         "y_xnOPeMSc9cacgnUjpXbAEyoNeuHeZCbGIv-Vau5ak"
 *       ],
 *       "address": {
 *         "_sd": [
 *           "Z8Yl0BjQZdfw-fmo4BddtK5q0C7VON-ryf0TlFpUKYk",
 *           "KVmKs6pBGEl4vSM2kL_QgQELGj-NfGO8nRFnLt5geFY",
 *           "Zlrbm-A0wLMDRUd4gZ9H4RQbZGpT1ZQ4nYHiqtR6YOM"
 *         ]
 *       },
 *       "issuing_country": "DE",
 *       "vct": "urn:eu.europa.ec.eudi:pid:1",
 *       "issuing_authority": "DE",
 *       "_sd_alg": "sha-256",
 *       "iss": "https://demo.pid-issuer.bundesdruckerei.de/c",
 *       "cnf": {
 *         "jwk": {
 *           "kty": "EC",
 *           "crv": "P-256",
 *           "x": "U6X8PoqizZ3-PrNowRUQh7n-twm9Zo1wU8tX91PEm_8",
 *           "y": "tfcdqgKrUU22GeEWE749La8dHYELbfJGCYQ_aQR3pOs"
 *         }
 *       },
 *       "exp": 1718707804,
 *       "iat": 1717498204,
 *       "age_equal_or_over": {
 *         "_sd": [
 *           "L9Swe-8pu1gYeKImuCeCTJq60843yiRyUuFXtiGRoYs",
 *           "UaVyiNJVsxTutyITokYulP2vr5Zhq3EEQ1ckgZm4tGQ",
 *           "XFyefCOodqIvI2BouF_aAPU0_md9Z-B7kPoiwx57XFM",
 *           "lQyghXZrV4vtQ9KpUZJ6pzGH9VTHEB9093V7cBf2HD8",
 *           "_csV778GRtGuvPuvRwV-uHXBzIoQ3O0F4mPuPueXjXM",
 *           "zmbmqSh019Mg1wAViubrilMIm4RzlMhnsN5Z-dBEHyk"
 *         ]
 *       }
 *     },
 *     "signature": "eX-vYUtV2FcJ2Qq8mlQybSlwmXjZ6jCzKdav-G5xR1mFOQFcLOWZ1j3dPRmdFCat3MWqsHbx6eaZjue4tmDF2Q"
 *   },
 *   "disclosures": [
 *     {
 *       "_digest": "GqeTHMmfXSr-TiXslpebu7vk-ZO0gbBw7I-mkOGi8RQ",
 *       "_encoded": "WyJKNm55NUdXVzlJZHNXQURKblNEQnN3IiwiZmFtaWx5X25hbWUiLCJNVVNURVJNQU5OIl0",
 *       "salt": "J6ny5GWW9IdsWADJnSDBsw",
 *       "key": "family_name",
 *       "value": "MUSTERMANN"
 *     },
 *     {
 *       "_digest": "32ZozgHF_dTXQMVLEizwFszRyoB1VK9lsgjAGhyTvpg",
 *       "_encoded": "WyJqcnVqMGV4RjdOVElGWEptOUJWQ1VnIiwiZ2l2ZW5fbmFtZSIsIkVSSUtBIl0",
 *       "salt": "jruj0exF7NTIFXJm9BVCUg",
 *       "key": "given_name",
 *       "value": "ERIKA"
 *     },
 *     {
 *       "_digest": "ohmcZBLMIPTa9cvpuMutsqdYuQai4bGdbnaId4Rx0Pk",
 *       "_encoded": "WyJRRkJBbnFIaUo3Y1A1MHBDak1IdUFBIiwiYmlydGhkYXRlIiwiMTk2NC0wOC0xMiJd",
 *       "salt": "QFBAnqHiJ7cP50pCjMHuAA",
 *       "key": "birthdate",
 *       "value": "1964-08-12"
 *     },
 *     {
 *       "_digest": "wPCI_o4-lXVW92JEBBBOk50QeHHd-aixXbs9bythnyc",
 *       "_encoded": "WyI1MmQxQVNmbmE3N1JERXE3bnR4ODFnIiwiYWdlX2JpcnRoX3llYXIiLDE5NjRd",
 *       "salt": "52d1ASfna77RDEq7ntx81g",
 *       "key": "age_birth_year",
 *       "value": 1964
 *     },
 *     {
 *       "_digest": "ji2wUwzEbBZaF8tm-dKiFRU6imZtm55daNfEZaoqY0s",
 *       "_encoded": "WyJiZmRSdEl5NV9kRWloc3BRTmwzNDNBIiwiYWdlX2luX3llYXJzIiw1OV0",
 *       "salt": "bfdRtIy5_dEihspQNl343A",
 *       "key": "age_in_years",
 *       "value": 59
 *     },
 *     {
 *       "_digest": "vNBKdJ5EijAnel1iS8daKKByMgzwrRzPsMOoPFSZBPA",
 *       "_encoded": "WyJXbG43VmxHTXhaXzRlSkc0dmNkYTRnIiwiYmlydGhfZmFtaWx5X25hbWUiLCJHQUJMRVIiXQ",
 *       "salt": "Wln7VlGMxZ_4eJG4vcda4g",
 *       "key": "birth_family_name",
 *       "value": "GABLER"
 *     },
 *     {
 *       "_digest": "y_xnOPeMSc9cacgnUjpXbAEyoNeuHeZCbGIv-Vau5ak",
 *       "_encoded": "WyJBUFdMWlRVOHRzS3NNWXBzazhtclVnIiwibmF0aW9uYWxpdGllcyIsWyJERSJdXQ",
 *       "salt": "APWLZTU8tsKsMYpsk8mrUg",
 *       "key": "nationalities",
 *       "value": [
 *         "DE"
 *       ]
 *     },
 *     {
 *       "_digest": "L9Swe-8pu1gYeKImuCeCTJq60843yiRyUuFXtiGRoYs",
 *       "_encoded": "WyJOaE9LaFRNdEhxU2pzdmV1ekFLbWpBIiwiMTIiLHRydWVd",
 *       "salt": "NhOKhTMtHqSjsveuzAKmjA",
 *       "key": "12",
 *       "value": true
 *     },
 *     {
 *       "_digest": "UaVyiNJVsxTutyITokYulP2vr5Zhq3EEQ1ckgZm4tGQ",
 *       "_encoded": "WyJFTlFGWURlTEV0bEo3cDhzdEFMSDJRIiwiMTQiLHRydWVd",
 *       "salt": "ENQFYDeLEtlJ7p8stALH2Q",
 *       "key": "14",
 *       "value": true
 *     },
 *     {
 *       "_digest": "XFyefCOodqIvI2BouF_aAPU0_md9Z-B7kPoiwx57XFM",
 *       "_encoded": "WyJtNE5QUHFxY0VxVm4tWVNyQkFNMHVBIiwiMTYiLHRydWVd",
 *       "salt": "m4NPPqqcEqVn-YSrBAM0uA",
 *       "key": "16",
 *       "value": true
 *     },
 *     {
 *       "_digest": "lQyghXZrV4vtQ9KpUZJ6pzGH9VTHEB9093V7cBf2HD8",
 *       "_encoded": "WyJNT1R4eG1kUk05alhoX3dHbzZTQXpRIiwiMTgiLHRydWVd",
 *       "salt": "MOTxxmdRM9jXh_wGo6SAzQ",
 *       "key": "18",
 *       "value": true
 *     },
 *     {
 *       "_digest": "_csV778GRtGuvPuvRwV-uHXBzIoQ3O0F4mPuPueXjXM",
 *       "_encoded": "WyJNZ3oySzRqTzFJVlZCU015RTNoZ1JRIiwiMjEiLHRydWVd",
 *       "salt": "Mgz2K4jO1IVVBSMyE3hgRQ",
 *       "key": "21",
 *       "value": true
 *     },
 *     {
 *       "_digest": "zmbmqSh019Mg1wAViubrilMIm4RzlMhnsN5Z-dBEHyk",
 *       "_encoded": "WyJNN0tjb0JIMjZPVzhPZUFicmZMakx3IiwiNjUiLGZhbHNlXQ",
 *       "salt": "M7KcoBH26OW8OeAbrfLjLw",
 *       "key": "65",
 *       "value": false
 *     },
 *     {
 *       "_digest": "eSQx9U4R8KgJRrHIfNa7OyHSGb7Y8wlSZZG41upXSvk",
 *       "_encoded": "WyJRaW5JUERxdnJFem5Talp1MkZqOUl3IiwibG9jYWxpdHkiLCJCRVJMSU4iXQ",
 *       "salt": "QinIPDqvrEznSjZu2Fj9Iw",
 *       "key": "locality",
 *       "value": "BERLIN"
 *     },
 *     {
 *       "_digest": "Z8Yl0BjQZdfw-fmo4BddtK5q0C7VON-ryf0TlFpUKYk",
 *       "_encoded": "WyJxVFg0Si1URFBqTHh3TElhU3NZLWlBIiwibG9jYWxpdHkiLCJLw5ZMTiJd",
 *       "salt": "qTX4J-TDPjLxwLIaSsY-iA",
 *       "key": "locality",
 *       "value": "KÖLN"
 *     },
 *     {
 *       "_digest": "KVmKs6pBGEl4vSM2kL_QgQELGj-NfGO8nRFnLt5geFY",
 *       "_encoded": "WyJFSlNfdFlyVGI4VWVYWXJGY3pkNUd3IiwicG9zdGFsX2NvZGUiLCI1MTE0NyJd",
 *       "salt": "EJS_tYrTb8UeXYrFczd5Gw",
 *       "key": "postal_code",
 *       "value": "51147"
 *     },
 *     {
 *       "_digest": "Zlrbm-A0wLMDRUd4gZ9H4RQbZGpT1ZQ4nYHiqtR6YOM",
 *       "_encoded": "WyJRZFhXN3BaWkVpV1ZLbXFZOGg1d0VBIiwic3RyZWV0X2FkZHJlc3MiLCJIRUlERVNUUkHhup5FIDE3Il0",
 *       "salt": "QdXW7pZZEiWVKmqY8h5wEA",
 *       "key": "street_address",
 *       "value": "HEIDESTRAẞE 17"
 *     }
 *   ]
 * }
 */
export const funkeX509 = {
  sdJwtVc:
    'eyJ4NWMiOlsiTUlJQ2REQ0NBaHVnQXdJQkFnSUJBakFLQmdncWhrak9QUVFEQWpDQmlERUxNQWtHQTFVRUJoTUNSRVV4RHpBTkJnTlZCQWNNQmtKbGNteHBiakVkTUJzR0ExVUVDZ3dVUW5WdVpHVnpaSEoxWTJ0bGNtVnBJRWR0WWtneEVUQVBCZ05WQkFzTUNGUWdRMU1nU1VSRk1UWXdOQVlEVlFRRERDMVRVRkpKVGtRZ1JuVnVhMlVnUlZWRVNTQlhZV3hzWlhRZ1VISnZkRzkwZVhCbElFbHpjM1ZwYm1jZ1EwRXdIaGNOTWpRd05UTXhNRGd4TXpFM1doY05NalV3TnpBMU1EZ3hNekUzV2pCc01Rc3dDUVlEVlFRR0V3SkVSVEVkTUJzR0ExVUVDZ3dVUW5WdVpHVnpaSEoxWTJ0bGNtVnBJRWR0WWtneENqQUlCZ05WQkFzTUFVa3hNakF3QmdOVkJBTU1LVk5RVWtsT1JDQkdkVzVyWlNCRlZVUkpJRmRoYkd4bGRDQlFjbTkwYjNSNWNHVWdTWE56ZFdWeU1Ga3dFd1lIS29aSXpqMENBUVlJS29aSXpqMERBUWNEUWdBRU9GQnE0WU1LZzR3NWZUaWZzeXR3QnVKZi83RTdWaFJQWGlObTUyUzNxMUVUSWdCZFh5REsza1Z4R3hnZUhQaXZMUDN1dU12UzZpREVjN3FNeG12ZHVLT0JrRENCalRBZEJnTlZIUTRFRmdRVWlQaENrTEVyRFhQTFcyL0owV1ZlZ2h5dyttSXdEQVlEVlIwVEFRSC9CQUl3QURBT0JnTlZIUThCQWY4RUJBTUNCNEF3TFFZRFZSMFJCQ1l3SklJaVpHVnRieTV3YVdRdGFYTnpkV1Z5TG1KMWJtUmxjMlJ5ZFdOclpYSmxhUzVrWlRBZkJnTlZIU01FR0RBV2dCVFVWaGpBaVRqb0RsaUVHTWwyWXIrcnU4V1F2akFLQmdncWhrak9QUVFEQWdOSEFEQkVBaUFiZjVUemtjUXpoZldvSW95aTFWTjdkOEk5QnNGS20xTVdsdVJwaDJieUdRSWdLWWtkck5mMnhYUGpWU2JqVy9VLzVTNXZBRUM1WHhjT2FudXNPQnJvQmJVPSIsIk1JSUNlVENDQWlDZ0F3SUJBZ0lVQjVFOVFWWnRtVVljRHRDaktCL0gzVlF2NzJnd0NnWUlLb1pJemowRUF3SXdnWWd4Q3pBSkJnTlZCQVlUQWtSRk1ROHdEUVlEVlFRSERBWkNaWEpzYVc0eEhUQWJCZ05WQkFvTUZFSjFibVJsYzJSeWRXTnJaWEpsYVNCSGJXSklNUkV3RHdZRFZRUUxEQWhVSUVOVElFbEVSVEUyTURRR0ExVUVBd3d0VTFCU1NVNUVJRVoxYm10bElFVlZSRWtnVjJGc2JHVjBJRkJ5YjNSdmRIbHdaU0JKYzNOMWFXNW5JRU5CTUI0WERUSTBNRFV6TVRBMk5EZ3dPVm9YRFRNME1EVXlPVEEyTkRnd09Wb3dnWWd4Q3pBSkJnTlZCQVlUQWtSRk1ROHdEUVlEVlFRSERBWkNaWEpzYVc0eEhUQWJCZ05WQkFvTUZFSjFibVJsYzJSeWRXTnJaWEpsYVNCSGJXSklNUkV3RHdZRFZRUUxEQWhVSUVOVElFbEVSVEUyTURRR0ExVUVBd3d0VTFCU1NVNUVJRVoxYm10bElFVlZSRWtnVjJGc2JHVjBJRkJ5YjNSdmRIbHdaU0JKYzNOMWFXNW5JRU5CTUZrd0V3WUhLb1pJemowQ0FRWUlLb1pJemowREFRY0RRZ0FFWUd6ZHdGRG5jNytLbjVpYkF2Q09NOGtlNzdWUXhxZk1jd1pMOElhSUErV0NST2NDZm1ZL2dpSDkycU1ydTVwL2t5T2l2RTBSQy9JYmRNT052RG9VeWFObU1HUXdIUVlEVlIwT0JCWUVGTlJXR01DSk9PZ09XSVFZeVhaaXY2dTd4WkMrTUI4R0ExVWRJd1FZTUJhQUZOUldHTUNKT09nT1dJUVl5WFppdjZ1N3haQytNQklHQTFVZEV3RUIvd1FJTUFZQkFmOENBUUF3RGdZRFZSMFBBUUgvQkFRREFnR0dNQW9HQ0NxR1NNNDlCQU1DQTBjQU1FUUNJR0VtN3drWktIdC9hdGI0TWRGblhXNnlybndNVVQydTEzNmdkdGwxMFk2aEFpQnVURnF2Vll0aDFyYnh6Q1AweFdaSG1RSzlrVnl4bjhHUGZYMjdFSXp6c3c9PSJdLCJraWQiOiJNSUdVTUlHT3BJR0xNSUdJTVFzd0NRWURWUVFHRXdKRVJURVBNQTBHQTFVRUJ3d0dRbVZ5YkdsdU1SMHdHd1lEVlFRS0RCUkNkVzVrWlhOa2NuVmphMlZ5WldrZ1IyMWlTREVSTUE4R0ExVUVDd3dJVkNCRFV5QkpSRVV4TmpBMEJnTlZCQU1NTFZOUVVrbE9SQ0JHZFc1clpTQkZWVVJKSUZkaGJHeGxkQ0JRY205MGIzUjVjR1VnU1hOemRXbHVaeUJEUVFJQkFnPT0iLCJ0eXAiOiJ2YytzZC1qd3QiLCJhbGciOiJFUzI1NiJ9.eyJwbGFjZV9vZl9iaXJ0aCI6eyJfc2QiOlsiZVNReDlVNFI4S2dKUnJISWZOYTdPeUhTR2I3WTh3bFNaWkc0MXVwWFN2ayJdfSwiX3NkIjpbIkdxZVRITW1mWFNyLVRpWHNscGVidTd2ay1aTzBnYkJ3N0ktbWtPR2k4UlEiLCIzMlpvemdIRl9kVFhRTVZMRWl6d0ZzelJ5b0IxVks5bHNnakFHaHlUdnBnIiwib2htY1pCTE1JUFRhOWN2cHVNdXRzcWRZdVFhaTRiR2RibmFJZDRSeDBQayIsIndQQ0lfbzQtbFhWVzkySkVCQkJPazUwUWVISGQtYWl4WGJzOWJ5dGhueWMiLCJqaTJ3VXd6RWJCWmFGOHRtLWRLaUZSVTZpbVp0bTU1ZGFOZkVaYW9xWTBzIiwidk5CS2RKNUVpakFuZWwxaVM4ZGFLS0J5TWd6d3JSelBzTU9vUEZTWkJQQSIsInlfeG5PUGVNU2M5Y2FjZ25VanBYYkFFeW9OZXVIZVpDYkdJdi1WYXU1YWsiXSwiYWRkcmVzcyI6eyJfc2QiOlsiWjhZbDBCalFaZGZ3LWZtbzRCZGR0SzVxMEM3Vk9OLXJ5ZjBUbEZwVUtZayIsIktWbUtzNnBCR0VsNHZTTTJrTF9RZ1FFTEdqLU5mR084blJGbkx0NWdlRlkiLCJabHJibS1BMHdMTURSVWQ0Z1o5SDRSUWJaR3BUMVpRNG5ZSGlxdFI2WU9NIl19LCJpc3N1aW5nX2NvdW50cnkiOiJERSIsInZjdCI6InVybjpldS5ldXJvcGEuZWMuZXVkaTpwaWQ6MSIsImlzc3VpbmdfYXV0aG9yaXR5IjoiREUiLCJfc2RfYWxnIjoic2hhLTI1NiIsImlzcyI6Imh0dHBzOi8vZGVtby5waWQtaXNzdWVyLmJ1bmRlc2RydWNrZXJlaS5kZS9jIiwiY25mIjp7Imp3ayI6eyJrdHkiOiJFQyIsImNydiI6IlAtMjU2IiwieCI6IlU2WDhQb3FpelozLVByTm93UlVRaDduLXR3bTlabzF3VTh0WDkxUEVtXzgiLCJ5IjoidGZjZHFnS3JVVTIyR2VFV0U3NDlMYThkSFlFTGJmSkdDWVFfYVFSM3BPcyJ9fSwiZXhwIjoxNzE4NzA3ODA0LCJpYXQiOjE3MTc0OTgyMDQsImFnZV9lcXVhbF9vcl9vdmVyIjp7Il9zZCI6WyJMOVN3ZS04cHUxZ1llS0ltdUNlQ1RKcTYwODQzeWlSeVV1Rlh0aUdSb1lzIiwiVWFWeWlOSlZzeFR1dHlJVG9rWXVsUDJ2cjVaaHEzRUVRMWNrZ1ptNHRHUSIsIlhGeWVmQ09vZHFJdkkyQm91Rl9hQVBVMF9tZDlaLUI3a1BvaXd4NTdYRk0iLCJsUXlnaFhaclY0dnRROUtwVVpKNnB6R0g5VlRIRUI5MDkzVjdjQmYySEQ4IiwiX2NzVjc3OEdSdEd1dlB1dlJ3Vi11SFhCeklvUTNPMEY0bVB1UHVlWGpYTSIsInptYm1xU2gwMTlNZzF3QVZpdWJyaWxNSW00UnpsTWhuc041Wi1kQkVIeWsiXX19.eX-vYUtV2FcJ2Qq8mlQybSlwmXjZ6jCzKdav-G5xR1mFOQFcLOWZ1j3dPRmdFCat3MWqsHbx6eaZjue4tmDF2Q~WyJKNm55NUdXVzlJZHNXQURKblNEQnN3IiwiZmFtaWx5X25hbWUiLCJNVVNURVJNQU5OIl0~WyJqcnVqMGV4RjdOVElGWEptOUJWQ1VnIiwiZ2l2ZW5fbmFtZSIsIkVSSUtBIl0~WyJRRkJBbnFIaUo3Y1A1MHBDak1IdUFBIiwiYmlydGhkYXRlIiwiMTk2NC0wOC0xMiJd~WyI1MmQxQVNmbmE3N1JERXE3bnR4ODFnIiwiYWdlX2JpcnRoX3llYXIiLDE5NjRd~WyJiZmRSdEl5NV9kRWloc3BRTmwzNDNBIiwiYWdlX2luX3llYXJzIiw1OV0~WyJXbG43VmxHTXhaXzRlSkc0dmNkYTRnIiwiYmlydGhfZmFtaWx5X25hbWUiLCJHQUJMRVIiXQ~WyJBUFdMWlRVOHRzS3NNWXBzazhtclVnIiwibmF0aW9uYWxpdGllcyIsWyJERSJdXQ~WyJOaE9LaFRNdEhxU2pzdmV1ekFLbWpBIiwiMTIiLHRydWVd~WyJFTlFGWURlTEV0bEo3cDhzdEFMSDJRIiwiMTQiLHRydWVd~WyJtNE5QUHFxY0VxVm4tWVNyQkFNMHVBIiwiMTYiLHRydWVd~WyJNT1R4eG1kUk05alhoX3dHbzZTQXpRIiwiMTgiLHRydWVd~WyJNZ3oySzRqTzFJVlZCU015RTNoZ1JRIiwiMjEiLHRydWVd~WyJNN0tjb0JIMjZPVzhPZUFicmZMakx3IiwiNjUiLGZhbHNlXQ~WyJRaW5JUERxdnJFem5Talp1MkZqOUl3IiwibG9jYWxpdHkiLCJCRVJMSU4iXQ~WyJxVFg0Si1URFBqTHh3TElhU3NZLWlBIiwibG9jYWxpdHkiLCJLw5ZMTiJd~WyJFSlNfdFlyVGI4VWVYWXJGY3pkNUd3IiwicG9zdGFsX2NvZGUiLCI1MTE0NyJd~WyJRZFhXN3BaWkVpV1ZLbXFZOGg1d0VBIiwic3RyZWV0X2FkZHJlc3MiLCJIRUlERVNUUkHhup5FIDE3Il0~',
  trustedCertificate:
    'MIICdDCCAhugAwIBAgIBAjAKBggqhkjOPQQDAjCBiDELMAkGA1UEBhMCREUxDzANBgNVBAcMBkJlcmxpbjEdMBsGA1UECgwUQnVuZGVzZHJ1Y2tlcmVpIEdtYkgxETAPBgNVBAsMCFQgQ1MgSURFMTYwNAYDVQQDDC1TUFJJTkQgRnVua2UgRVVESSBXYWxsZXQgUHJvdG90eXBlIElzc3VpbmcgQ0EwHhcNMjQwNTMxMDgxMzE3WhcNMjUwNzA1MDgxMzE3WjBsMQswCQYDVQQGEwJERTEdMBsGA1UECgwUQnVuZGVzZHJ1Y2tlcmVpIEdtYkgxCjAIBgNVBAsMAUkxMjAwBgNVBAMMKVNQUklORCBGdW5rZSBFVURJIFdhbGxldCBQcm90b3R5cGUgSXNzdWVyMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEOFBq4YMKg4w5fTifsytwBuJf/7E7VhRPXiNm52S3q1ETIgBdXyDK3kVxGxgeHPivLP3uuMvS6iDEc7qMxmvduKOBkDCBjTAdBgNVHQ4EFgQUiPhCkLErDXPLW2/J0WVeghyw+mIwDAYDVR0TAQH/BAIwADAOBgNVHQ8BAf8EBAMCB4AwLQYDVR0RBCYwJIIiZGVtby5waWQtaXNzdWVyLmJ1bmRlc2RydWNrZXJlaS5kZTAfBgNVHSMEGDAWgBTUVhjAiTjoDliEGMl2Yr+ru8WQvjAKBggqhkjOPQQDAgNHADBEAiAbf5TzkcQzhfWoIoyi1VN7d8I9BsFKm1MWluRph2byGQIgKYkdrNf2xXPjVSbjW/U/5S5vAEC5XxcOanusOBroBbU=',
}

/** expiredSdJwtVc
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
 *       "exp": 1716111919,
 *       "iss": "did:key:z6MktqtXNG8CDUY9PrrtoStFzeCnhpMmgxYL1gikcW3BzvNW",
 *       "iat": 1698151532
 *     },
 *     "signature": "hOQ-CnT-iaL2_Dlui0NgVhBk2Lej4_AqDrEK-7bQNT2b6mJkaikvUXdNtg-z7GnCUNrjq35vm5ProqiyYQz_AA"
 *   },
 *   "disclosures": []
 * }
 */
export const expiredSdJwtVc =
  'eyJ0eXAiOiJ2YytzZC1qd3QiLCJhbGciOiJFZERTQSIsImtpZCI6IiN6Nk1rdHF0WE5HOENEVVk5UHJydG9TdEZ6ZUNuaHBNbWd4WUwxZ2lrY1czQnp2TlcifQ.eyJjbGFpbSI6InNvbWUtY2xhaW0iLCJ2Y3QiOiJJZGVudGl0eUNyZWRlbnRpYWwiLCJleHAiOjE3MTYxMTE5MTksImlzcyI6ImRpZDprZXk6ejZNa3RxdFhORzhDRFVZOVBycnRvU3RGemVDbmhwTW1neFlMMWdpa2NXM0J6dk5XIiwiaWF0IjoxNjk4MTUxNTMyfQ.hOQ-CnT-iaL2_Dlui0NgVhBk2Lej4_AqDrEK-7bQNT2b6mJkaikvUXdNtg-z7GnCUNrjq35vm5ProqiyYQz_AA~'

/** notBeforeInFutureSdJwtVc
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
 *       "nbf": 4078944000,
 *       "iss": "did:key:z6MktqtXNG8CDUY9PrrtoStFzeCnhpMmgxYL1gikcW3BzvNW",
 *       "iat": 1698151532
 *     },
 *     "signature": "u0GPVCt7gPTrvT3sAwXxwkKW_Zy6YRRTaVRkrcSWt9VPonxQHUua2ggOERAu5cgtLeSdXzyqvS8nE9xFJg7xCw"
 *   },
 *   "disclosures": []
 * }
 */
export const notBeforeInFutureSdJwtVc =
  'eyJ0eXAiOiJ2YytzZC1qd3QiLCJhbGciOiJFZERTQSIsImtpZCI6IiN6Nk1rdHF0WE5HOENEVVk5UHJydG9TdEZ6ZUNuaHBNbWd4WUwxZ2lrY1czQnp2TlcifQ.eyJjbGFpbSI6InNvbWUtY2xhaW0iLCJ2Y3QiOiJJZGVudGl0eUNyZWRlbnRpYWwiLCJuYmYiOjQwNzg5NDQwMDAsImlzcyI6ImRpZDprZXk6ejZNa3RxdFhORzhDRFVZOVBycnRvU3RGemVDbmhwTW1neFlMMWdpa2NXM0J6dk5XIiwiaWF0IjoxNjk4MTUxNTMyfQ.u0GPVCt7gPTrvT3sAwXxwkKW_Zy6YRRTaVRkrcSWt9VPonxQHUua2ggOERAu5cgtLeSdXzyqvS8nE9xFJg7xCw~'

/** contentChangedSdJwtVc
 * {
 *   "jwt": {
 *     "header": {
 *       "typ": "vc+sd-jwt",
 *       "alg": "EdDSA",
 *       "kid": "#z6MktqtXNG8CDUY9PrrtoStFzeCnhpMmgxYL1gikcW3BzvNW"
 *     },
 *     "payload": {
 *       "claim": "some-claim",
 *       "vct": "IdentityCredential2",
 *       "iss": "did:key:z6MktqtXNG8CDUY9PrrtoStFzeCnhpMmgxYL1gikcW3BzvNW",
 *       "iat": 1698151532
 *     },
 *     "signature": "TsFJUFKwdw5kVL4eY5vHOPGHqXBCFJ-n9c9KwPHkXAVfZ1TZkGA8m0_sNuTDy5n_pCutS6uzKJDAM0dfeGPyDg"
 *   },
 *   "disclosures": []
 * }
 */
export const contentChangedSdJwtVc =
  'eyJ0eXAiOiJ2YytzZC1qd3QiLCJhbGciOiJFZERTQSIsImtpZCI6IiN6Nk1rdHF0WE5HOENEVVk5UHJydG9TdEZ6ZUNuaHBNbWd4WUwxZ2lrY1czQnp2TlcifQ.eyJjbGFpbSI6InNvbWUtY2xhaW0iLCJ2Y3QiOiJJZGVudGl0eUNyZWRlbnRpYWwyIiwiaXNzIjoiZGlkOmtleTp6Nk1rdHF0WE5HOENEVVk5UHJydG9TdEZ6ZUNuaHBNbWd4WUwxZ2lrY1czQnp2TlciLCJpYXQiOjE2OTgxNTE1MzJ9.TsFJUFKwdw5kVL4eY5vHOPGHqXBCFJ-n9c9KwPHkXAVfZ1TZkGA8m0_sNuTDy5n_pCutS6uzKJDAM0dfeGPyDg~'

/** signatureInvalidSdJwtVc
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
 *       "iss": "did:key:z6MktqtXNG8CDUY9PrrtoStFzeCnhpMmgxYL1gikcW3BzvNW",
 *       "iat": 1698151532
 *     },
 *     "signature": "TsFJUFKwdw5kVL4eY5vHOPGHqXBCFJ-n9c9KwPHkXAVfZ1TZkGA8m0_sNuTDy5n_pCutd6uzKJDAM0dfeGPyDg"
 *   },
 *   "disclosures": []
 * }
 */
export const signatureInvalidSdJwtVc =
  'eyJ0eXAiOiJ2YytzZC1qd3QiLCJhbGciOiJFZERTQSIsImtpZCI6IiN6Nk1rdHF0WE5HOENEVVk5UHJydG9TdEZ6ZUNuaHBNbWd4WUwxZ2lrY1czQnp2TlcifQ.eyJjbGFpbSI6InNvbWUtY2xhaW0iLCJ2Y3QiOiJJZGVudGl0eUNyZWRlbnRpYWwiLCJpc3MiOiJkaWQ6a2V5Ono2TWt0cXRYTkc4Q0RVWTlQcnJ0b1N0RnplQ25ocE1tZ3hZTDFnaWtjVzNCenZOVyIsImlhdCI6MTY5ODE1MTUzMn0.TsFJUFKwdw5kVL4eY5vHOPGHqXBCFJ-n9c9KwPHkXAVfZ1TZkGA8m0_sNuTDy5n_pCutd6uzKJDAM0dfeGPyDg~'

/** simpleSdJwtVcWithStatus
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
 *       "status": {
 *         "status_list": {
 *           "idx": 12,
 *           "uri": "https://example.com/status-list"
 *         }
 *       },
 *       "iss": "did:key:z6MktqtXNG8CDUY9PrrtoStFzeCnhpMmgxYL1gikcW3BzvNW",
 *       "iat": 1698151532
 *     },
 *     "signature": "JWE6RRGt032UsQ9EoyJnvxq7dAQX2DjW6mLYuvDkCuq0fzse5V_7RO6R0RBCPHXWWIfnCNAA8oEI3QM6A3avDg"
 *   },
 *   "disclosures": []
 * }
 */
export const simpleSdJwtVcWithStatus =
  'eyJ0eXAiOiJ2YytzZC1qd3QiLCJhbGciOiJFZERTQSIsImtpZCI6IiN6Nk1rdHF0WE5HOENEVVk5UHJydG9TdEZ6ZUNuaHBNbWd4WUwxZ2lrY1czQnp2TlcifQ.eyJjbGFpbSI6InNvbWUtY2xhaW0iLCJ2Y3QiOiJJZGVudGl0eUNyZWRlbnRpYWwiLCJzdGF0dXMiOnsic3RhdHVzX2xpc3QiOnsiaWR4IjoxMiwidXJpIjoiaHR0cHM6Ly9leGFtcGxlLmNvbS9zdGF0dXMtbGlzdCJ9fSwiaXNzIjoiZGlkOmtleTp6Nk1rdHF0WE5HOENEVVk5UHJydG9TdEZ6ZUNuaHBNbWd4WUwxZ2lrY1czQnp2TlciLCJpYXQiOjE2OTgxNTE1MzJ9.JWE6RRGt032UsQ9EoyJnvxq7dAQX2DjW6mLYuvDkCuq0fzse5V_7RO6R0RBCPHXWWIfnCNAA8oEI3QM6A3avDg~'

/** simpleJwtVcWithoutHolderBinding
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
 *       "iss": "did:key:z6MktqtXNG8CDUY9PrrtoStFzeCnhpMmgxYL1gikcW3BzvNW",
 *       "iat": 1698151532
 *     },
 *     "signature": "TsFJUFKwdw5kVL4eY5vHOPGHqXBCFJ-n9c9KwPHkXAVfZ1TZkGA8m0_sNuTDy5n_pCutS6uzKJDAM0dfeGPyDg"
 *   },
 *   "disclosures": []
 * }
 */
export const simpleJwtVcWithoutHolderBinding =
  'eyJ0eXAiOiJ2YytzZC1qd3QiLCJhbGciOiJFZERTQSIsImtpZCI6IiN6Nk1rdHF0WE5HOENEVVk5UHJydG9TdEZ6ZUNuaHBNbWd4WUwxZ2lrY1czQnp2TlcifQ.eyJjbGFpbSI6InNvbWUtY2xhaW0iLCJ2Y3QiOiJJZGVudGl0eUNyZWRlbnRpYWwiLCJpc3MiOiJkaWQ6a2V5Ono2TWt0cXRYTkc4Q0RVWTlQcnJ0b1N0RnplQ25ocE1tZ3hZTDFnaWtjVzNCenZOVyIsImlhdCI6MTY5ODE1MTUzMn0.TsFJUFKwdw5kVL4eY5vHOPGHqXBCFJ-n9c9KwPHkXAVfZ1TZkGA8m0_sNuTDy5n_pCutS6uzKJDAM0dfeGPyDg~'

/** sdJwtVcPid
 * {
 *   "jwt": {
 *     "header": {
 *       "x5c": [
 *         "MIICdDCCAhugAwIBAgIBAjAKBggqhkjOPQQDAjCBiDELMAkGA1UEBhMCREUxDzANBgNVBAcMBkJlcmxpbjEdMBsGA1UECgwUQnVuZGVzZHJ1Y2tlcmVpIEdtYkgxETAPBgNVBAsMCFQgQ1MgSURFMTYwNAYDVQQDDC1TUFJJTkQgRnVua2UgRVVESSBXYWxsZXQgUHJvdG90eXBlIElzc3VpbmcgQ0EwHhcNMjQwNTMxMDgxMzE3WhcNMjUwNzA1MDgxMzE3WjBsMQswCQYDVQQGEwJERTEdMBsGA1UECgwUQnVuZGVzZHJ1Y2tlcmVpIEdtYkgxCjAIBgNVBAsMAUkxMjAwBgNVBAMMKVNQUklORCBGdW5rZSBFVURJIFdhbGxldCBQcm90b3R5cGUgSXNzdWVyMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEOFBq4YMKg4w5fTifsytwBuJf/7E7VhRPXiNm52S3q1ETIgBdXyDK3kVxGxgeHPivLP3uuMvS6iDEc7qMxmvduKOBkDCBjTAdBgNVHQ4EFgQUiPhCkLErDXPLW2/J0WVeghyw+mIwDAYDVR0TAQH/BAIwADAOBgNVHQ8BAf8EBAMCB4AwLQYDVR0RBCYwJIIiZGVtby5waWQtaXNzdWVyLmJ1bmRlc2RydWNrZXJlaS5kZTAfBgNVHSMEGDAWgBTUVhjAiTjoDliEGMl2Yr+ru8WQvjAKBggqhkjOPQQDAgNHADBEAiAbf5TzkcQzhfWoIoyi1VN7d8I9BsFKm1MWluRph2byGQIgKYkdrNf2xXPjVSbjW/U/5S5vAEC5XxcOanusOBroBbU=",
 *         "MIICeTCCAiCgAwIBAgIUB5E9QVZtmUYcDtCjKB/H3VQv72gwCgYIKoZIzj0EAwIwgYgxCzAJBgNVBAYTAkRFMQ8wDQYDVQQHDAZCZXJsaW4xHTAbBgNVBAoMFEJ1bmRlc2RydWNrZXJlaSBHbWJIMREwDwYDVQQLDAhUIENTIElERTE2MDQGA1UEAwwtU1BSSU5EIEZ1bmtlIEVVREkgV2FsbGV0IFByb3RvdHlwZSBJc3N1aW5nIENBMB4XDTI0MDUzMTA2NDgwOVoXDTM0MDUyOTA2NDgwOVowgYgxCzAJBgNVBAYTAkRFMQ8wDQYDVQQHDAZCZXJsaW4xHTAbBgNVBAoMFEJ1bmRlc2RydWNrZXJlaSBHbWJIMREwDwYDVQQLDAhUIENTIElERTE2MDQGA1UEAwwtU1BSSU5EIEZ1bmtlIEVVREkgV2FsbGV0IFByb3RvdHlwZSBJc3N1aW5nIENBMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEYGzdwFDnc7+Kn5ibAvCOM8ke77VQxqfMcwZL8IaIA+WCROcCfmY/giH92qMru5p/kyOivE0RC/IbdMONvDoUyaNmMGQwHQYDVR0OBBYEFNRWGMCJOOgOWIQYyXZiv6u7xZC+MB8GA1UdIwQYMBaAFNRWGMCJOOgOWIQYyXZiv6u7xZC+MBIGA1UdEwEB/wQIMAYBAf8CAQAwDgYDVR0PAQH/BAQDAgGGMAoGCCqGSM49BAMCA0cAMEQCIGEm7wkZKHt/atb4MdFnXW6yrnwMUT2u136gdtl10Y6hAiBuTFqvVYth1rbxzCP0xWZHmQK9kVyxn8GPfX27EIzzsw=="
 *       ],
 *       "kid": "MIGUMIGOpIGLMIGIMQswCQYDVQQGEwJERTEPMA0GA1UEBwwGQmVybGluMR0wGwYDVQQKDBRCdW5kZXNkcnVja2VyZWkgR21iSDERMA8GA1UECwwIVCBDUyBJREUxNjA0BgNVBAMMLVNQUklORCBGdW5rZSBFVURJIFdhbGxldCBQcm90b3R5cGUgSXNzdWluZyBDQQIBAg==",
 *       "typ": "vc+sd-jwt",
 *       "alg": "ES256"
 *     },
 *     "payload": {
 *       "place_of_birth": {
 *         "_sd": [
 *           "hosHyTJJXEtmlwop-wMOPGSVwRw17s9o73I2szeBVDo"
 *         ]
 *       },
 *       "_sd": [
 *         "4Cl5ZgKk7nzWOEfaWklagAjANwBdLx2ROnTUHkKRYcU",
 *         "5jd-aqDdT_Bu-WkF9somnMxEHJtrTlQbT_EODk-rRSs",
 *         "6fz4GhEZyfzZFwMcWNL_BTtptsDwtkWXZn7jN_kSQgY",
 *         "C7TmcKYlTp4O-9Vr4HFtqGAAe04DG_qfs-834iIRLTo",
 *         "PTJkNPrLL7kzopZONvVsjfijiJ-kuw61nALbTXZl8Xo",
 *         "RgtxsNHpU5FI7LMkY-oD7dVxyKM2G8EG9htvMRidPPE",
 *         "bxaL2Cki_pvTlaadQSC01YajEPqyX39NDWDSgBSdnfQ"
 *       ],
 *       "address": {
 *         "_sd": [
 *           "96jV6Y_-8wemqX1jYLvCu7txuTQOMK173yGYgQm9CPA",
 *           "GYui7pvxmo2AqenV5YgBBkEtk8Xgs6KbMFGKJ7OW7bg",
 *           "fdt0Xmx8I28dfrmbA4-l9yd29jpVK8dPWyrR3CVLZoI",
 *           "qrgC5q3nqele8jYmY3BkzB0PxAlty16_FhrOkaFhkdY"
 *         ]
 *       },
 *       "issuing_country": "DE",
 *       "vct": "https://example.bmi.bund.de/credential/pid/1.0",
 *       "issuing_authority": "DE",
 *       "_sd_alg": "sha-256",
 *       "iss": "https://demo.pid-issuer.bundesdruckerei.de/c1",
 *       "cnf": {
 *         "jwk": {
 *           "kty": "EC",
 *           "crv": "P-256",
 *           "x": "NeX_ZniwxDOJD_Kyqf678V-Yx3f3-DZ0yD9XerpFmcc",
 *           "y": "gpo5H0zWaPM9yc7M2rex4IZ6Geb9J2842T3t6X8frAM"
 *         }
 *       },
 *       "exp": 1733709514,
 *       "iat": 1732499914,
 *       "age_equal_or_over": {
 *         "_sd": [
 *           "HmD-6yiaVOYPzdmWLPmyOxzr8q2gouO9J9V6U0POOV4",
 *           "Ins_bM9VNiBFWFM5tu5vt3tkZhZQBmcnKMIyAMzuv1s",
 *           "a9f3Oijt4prdf-WiorY1gOcdIb_WCsRpW9BKbOoFqQo",
 *           "eC_Plog0C-e2n7K4YSnSsAB4KKWTvlg2Zd9xDBmiD5g",
 *           "oa6QUyHlPne9AmmOoJN7ECP0DzDg-SIYJRt-qSayLVI",
 *           "vTfW0cePwECAsTm5V0SZfZzOIKAGfDr219j9jfhTHAE"
 *         ]
 *       }
 *     },
 *     "signature": "m5m6mQQu6O-4Y18VoIiv4mg4Jp5QPd0RStE8hPM_caqWo5prs8spXBB_0NBANGpqnNqEdK2yLRzGidZY8GRNHA"
 *   },
 *   "disclosures": [
 *     {
 *       "_digest": "PTJkNPrLL7kzopZONvVsjfijiJ-kuw61nALbTXZl8Xo",
 *       "_encoded": "WyI5NmhWUFZxWDJYOU5rUU9IME5WLW5nIiwiZmFtaWx5X25hbWUiLCJNVVNURVJNQU5OIl0",
 *       "salt": "96hVPVqX2X9NkQOH0NV-ng",
 *       "key": "family_name",
 *       "value": "MUSTERMANN"
 *     },
 *     {
 *       "_digest": "5jd-aqDdT_Bu-WkF9somnMxEHJtrTlQbT_EODk-rRSs",
 *       "_encoded": "WyJuME1ZOXVodmFCMEZ5YnZkQ2VDNHBnIiwiZ2l2ZW5fbmFtZSIsIkVSSUtBIl0",
 *       "salt": "n0MY9uhvaB0FybvdCeC4pg",
 *       "key": "given_name",
 *       "value": "ERIKA"
 *     },
 *     {
 *       "_digest": "6fz4GhEZyfzZFwMcWNL_BTtptsDwtkWXZn7jN_kSQgY",
 *       "_encoded": "WyJIYmwzTGZHeXFOaE5rZ05GajZyV2RBIiwiYmlydGhkYXRlIiwiMTk2NC0wOC0xMiJd",
 *       "salt": "Hbl3LfGyqNhNkgNFj6rWdA",
 *       "key": "birthdate",
 *       "value": "1964-08-12"
 *     },
 *     {
 *       "_digest": "4Cl5ZgKk7nzWOEfaWklagAjANwBdLx2ROnTUHkKRYcU",
 *       "_encoded": "WyJPcU9TTEdXNF9JTUdRLUdjRkpSS2pBIiwiYWdlX2JpcnRoX3llYXIiLDE5NjRd",
 *       "salt": "OqOSLGW4_IMGQ-GcFJRKjA",
 *       "key": "age_birth_year",
 *       "value": 1964
 *     },
 *     {
 *       "_digest": "bxaL2Cki_pvTlaadQSC01YajEPqyX39NDWDSgBSdnfQ",
 *       "_encoded": "WyJsdGpKV1k2cVM0V1p1bXlTNF9xcW5RIiwiYWdlX2luX3llYXJzIiw2MF0",
 *       "salt": "ltjJWY6qS4WZumyS4_qqnQ",
 *       "key": "age_in_years",
 *       "value": 60
 *     },
 *     {
 *       "_digest": "C7TmcKYlTp4O-9Vr4HFtqGAAe04DG_qfs-834iIRLTo",
 *       "_encoded": "WyJvVnFxdEY3LXdHSE5xNXJnSURlQTdnIiwiYmlydGhfZmFtaWx5X25hbWUiLCJHQUJMRVIiXQ",
 *       "salt": "oVqqtF7-wGHNq5rgIDeA7g",
 *       "key": "birth_family_name",
 *       "value": "GABLER"
 *     },
 *     {
 *       "_digest": "RgtxsNHpU5FI7LMkY-oD7dVxyKM2G8EG9htvMRidPPE",
 *       "_encoded": "WyI2TDZaSjRyN2lCTmdRVjY3SXR1c1JRIiwibmF0aW9uYWxpdGllcyIsWyJERSJdXQ",
 *       "salt": "6L6ZJ4r7iBNgQV67ItusRQ",
 *       "key": "nationalities",
 *       "value": [
 *         "DE"
 *       ]
 *     },
 *     {
 *       "_digest": "oa6QUyHlPne9AmmOoJN7ECP0DzDg-SIYJRt-qSayLVI",
 *       "_encoded": "WyJQLV9LSjhieTQ1NkJpenNWZ2N4UER3IiwiMTIiLHRydWVd",
 *       "salt": "P-_KJ8by456BizsVgcxPDw",
 *       "key": "12",
 *       "value": true
 *     },
 *     {
 *       "_digest": "HmD-6yiaVOYPzdmWLPmyOxzr8q2gouO9J9V6U0POOV4",
 *       "_encoded": "WyIwSmxOY0ZYd1FUYmMzMUF0SGlhY1lBIiwiMTQiLHRydWVd",
 *       "salt": "0JlNcFXwQTbc31AtHiacYA",
 *       "key": "14",
 *       "value": true
 *     },
 *     {
 *       "_digest": "a9f3Oijt4prdf-WiorY1gOcdIb_WCsRpW9BKbOoFqQo",
 *       "_encoded": "WyJldjR6UE85ckZZc3QtRE55V2hzMVZRIiwiMTYiLHRydWVd",
 *       "salt": "ev4zPO9rFYst-DNyWhs1VQ",
 *       "key": "16",
 *       "value": true
 *     },
 *     {
 *       "_digest": "vTfW0cePwECAsTm5V0SZfZzOIKAGfDr219j9jfhTHAE",
 *       "_encoded": "WyJ1OWxaSzljaE4wWVJWV082ZG9ySThRIiwiMTgiLHRydWVd",
 *       "salt": "u9lZK9chN0YRVWO6dorI8Q",
 *       "key": "18",
 *       "value": true
 *     },
 *     {
 *       "_digest": "Ins_bM9VNiBFWFM5tu5vt3tkZhZQBmcnKMIyAMzuv1s",
 *       "_encoded": "WyJnWkZqMUhmRS12azJFNmEzTzRESl93IiwiMjEiLHRydWVd",
 *       "salt": "gZFj1HfE-vk2E6a3O4DJ_w",
 *       "key": "21",
 *       "value": true
 *     },
 *     {
 *       "_digest": "eC_Plog0C-e2n7K4YSnSsAB4KKWTvlg2Zd9xDBmiD5g",
 *       "_encoded": "WyJweGNQWWIzZEFkYnhLMTdTUXR4SWRRIiwiNjUiLGZhbHNlXQ",
 *       "salt": "pxcPYb3dAdbxK17SQtxIdQ",
 *       "key": "65",
 *       "value": false
 *     },
 *     {
 *       "_digest": "hosHyTJJXEtmlwop-wMOPGSVwRw17s9o73I2szeBVDo",
 *       "_encoded": "WyJHU25uUnF0T2p0dl9FMk1Qd3l1bFZRIiwibG9jYWxpdHkiLCJCRVJMSU4iXQ",
 *       "salt": "GSnnRqtOjtv_E2MPwyulVQ",
 *       "key": "locality",
 *       "value": "BERLIN"
 *     },
 *     {
 *       "_digest": "96jV6Y_-8wemqX1jYLvCu7txuTQOMK173yGYgQm9CPA",
 *       "_encoded": "WyJoRmJNbnZGSWhtUXNpanpUT1Q1VFVnIiwibG9jYWxpdHkiLCJLw5ZMTiJd",
 *       "salt": "hFbMnvFIhmQsijzTOT5TUg",
 *       "key": "locality",
 *       "value": "KÖLN"
 *     },
 *     {
 *       "_digest": "GYui7pvxmo2AqenV5YgBBkEtk8Xgs6KbMFGKJ7OW7bg",
 *       "_encoded": "WyJUc3lxN3RSSm9LMmEzeF9PWFlmMWp3IiwiY291bnRyeSIsIkRFIl0",
 *       "salt": "Tsyq7tRJoK2a3x_OXYf1jw",
 *       "key": "country",
 *       "value": "DE"
 *     },
 *     {
 *       "_digest": "qrgC5q3nqele8jYmY3BkzB0PxAlty16_FhrOkaFhkdY",
 *       "_encoded": "WyJLQUwyVHFfSlZRLS1PMXBzYUJtSzhBIiwicG9zdGFsX2NvZGUiLCI1MTE0NyJd",
 *       "salt": "KAL2Tq_JVQ--O1psaBmK8A",
 *       "key": "postal_code",
 *       "value": "51147"
 *     },
 *     {
 *       "_digest": "fdt0Xmx8I28dfrmbA4-l9yd29jpVK8dPWyrR3CVLZoI",
 *       "_encoded": "WyJ4SFVxVkNwaGNSdVJYSVRZbDZsSndnIiwic3RyZWV0X2FkZHJlc3MiLCJIRUlERVNUUkHhup5FIDE3Il0",
 *       "salt": "xHUqVCphcRuRXITYl6lJwg",
 *       "key": "street_address",
 *       "value": "HEIDESTRAẞE 17"
 *     }
 *   ]
 * }
 */
export const sdJwtVcPid =
  'eyJ4NWMiOlsiTUlJQ2REQ0NBaHVnQXdJQkFnSUJBakFLQmdncWhrak9QUVFEQWpDQmlERUxNQWtHQTFVRUJoTUNSRVV4RHpBTkJnTlZCQWNNQmtKbGNteHBiakVkTUJzR0ExVUVDZ3dVUW5WdVpHVnpaSEoxWTJ0bGNtVnBJRWR0WWtneEVUQVBCZ05WQkFzTUNGUWdRMU1nU1VSRk1UWXdOQVlEVlFRRERDMVRVRkpKVGtRZ1JuVnVhMlVnUlZWRVNTQlhZV3hzWlhRZ1VISnZkRzkwZVhCbElFbHpjM1ZwYm1jZ1EwRXdIaGNOTWpRd05UTXhNRGd4TXpFM1doY05NalV3TnpBMU1EZ3hNekUzV2pCc01Rc3dDUVlEVlFRR0V3SkVSVEVkTUJzR0ExVUVDZ3dVUW5WdVpHVnpaSEoxWTJ0bGNtVnBJRWR0WWtneENqQUlCZ05WQkFzTUFVa3hNakF3QmdOVkJBTU1LVk5RVWtsT1JDQkdkVzVyWlNCRlZVUkpJRmRoYkd4bGRDQlFjbTkwYjNSNWNHVWdTWE56ZFdWeU1Ga3dFd1lIS29aSXpqMENBUVlJS29aSXpqMERBUWNEUWdBRU9GQnE0WU1LZzR3NWZUaWZzeXR3QnVKZi83RTdWaFJQWGlObTUyUzNxMUVUSWdCZFh5REsza1Z4R3hnZUhQaXZMUDN1dU12UzZpREVjN3FNeG12ZHVLT0JrRENCalRBZEJnTlZIUTRFRmdRVWlQaENrTEVyRFhQTFcyL0owV1ZlZ2h5dyttSXdEQVlEVlIwVEFRSC9CQUl3QURBT0JnTlZIUThCQWY4RUJBTUNCNEF3TFFZRFZSMFJCQ1l3SklJaVpHVnRieTV3YVdRdGFYTnpkV1Z5TG1KMWJtUmxjMlJ5ZFdOclpYSmxhUzVrWlRBZkJnTlZIU01FR0RBV2dCVFVWaGpBaVRqb0RsaUVHTWwyWXIrcnU4V1F2akFLQmdncWhrak9QUVFEQWdOSEFEQkVBaUFiZjVUemtjUXpoZldvSW95aTFWTjdkOEk5QnNGS20xTVdsdVJwaDJieUdRSWdLWWtkck5mMnhYUGpWU2JqVy9VLzVTNXZBRUM1WHhjT2FudXNPQnJvQmJVPSIsIk1JSUNlVENDQWlDZ0F3SUJBZ0lVQjVFOVFWWnRtVVljRHRDaktCL0gzVlF2NzJnd0NnWUlLb1pJemowRUF3SXdnWWd4Q3pBSkJnTlZCQVlUQWtSRk1ROHdEUVlEVlFRSERBWkNaWEpzYVc0eEhUQWJCZ05WQkFvTUZFSjFibVJsYzJSeWRXTnJaWEpsYVNCSGJXSklNUkV3RHdZRFZRUUxEQWhVSUVOVElFbEVSVEUyTURRR0ExVUVBd3d0VTFCU1NVNUVJRVoxYm10bElFVlZSRWtnVjJGc2JHVjBJRkJ5YjNSdmRIbHdaU0JKYzNOMWFXNW5JRU5CTUI0WERUSTBNRFV6TVRBMk5EZ3dPVm9YRFRNME1EVXlPVEEyTkRnd09Wb3dnWWd4Q3pBSkJnTlZCQVlUQWtSRk1ROHdEUVlEVlFRSERBWkNaWEpzYVc0eEhUQWJCZ05WQkFvTUZFSjFibVJsYzJSeWRXTnJaWEpsYVNCSGJXSklNUkV3RHdZRFZRUUxEQWhVSUVOVElFbEVSVEUyTURRR0ExVUVBd3d0VTFCU1NVNUVJRVoxYm10bElFVlZSRWtnVjJGc2JHVjBJRkJ5YjNSdmRIbHdaU0JKYzNOMWFXNW5JRU5CTUZrd0V3WUhLb1pJemowQ0FRWUlLb1pJemowREFRY0RRZ0FFWUd6ZHdGRG5jNytLbjVpYkF2Q09NOGtlNzdWUXhxZk1jd1pMOElhSUErV0NST2NDZm1ZL2dpSDkycU1ydTVwL2t5T2l2RTBSQy9JYmRNT052RG9VeWFObU1HUXdIUVlEVlIwT0JCWUVGTlJXR01DSk9PZ09XSVFZeVhaaXY2dTd4WkMrTUI4R0ExVWRJd1FZTUJhQUZOUldHTUNKT09nT1dJUVl5WFppdjZ1N3haQytNQklHQTFVZEV3RUIvd1FJTUFZQkFmOENBUUF3RGdZRFZSMFBBUUgvQkFRREFnR0dNQW9HQ0NxR1NNNDlCQU1DQTBjQU1FUUNJR0VtN3drWktIdC9hdGI0TWRGblhXNnlybndNVVQydTEzNmdkdGwxMFk2aEFpQnVURnF2Vll0aDFyYnh6Q1AweFdaSG1RSzlrVnl4bjhHUGZYMjdFSXp6c3c9PSJdLCJraWQiOiJNSUdVTUlHT3BJR0xNSUdJTVFzd0NRWURWUVFHRXdKRVJURVBNQTBHQTFVRUJ3d0dRbVZ5YkdsdU1SMHdHd1lEVlFRS0RCUkNkVzVrWlhOa2NuVmphMlZ5WldrZ1IyMWlTREVSTUE4R0ExVUVDd3dJVkNCRFV5QkpSRVV4TmpBMEJnTlZCQU1NTFZOUVVrbE9SQ0JHZFc1clpTQkZWVVJKSUZkaGJHeGxkQ0JRY205MGIzUjVjR1VnU1hOemRXbHVaeUJEUVFJQkFnPT0iLCJ0eXAiOiJ2YytzZC1qd3QiLCJhbGciOiJFUzI1NiJ9.eyJwbGFjZV9vZl9iaXJ0aCI6eyJfc2QiOlsiaG9zSHlUSkpYRXRtbHdvcC13TU9QR1NWd1J3MTdzOW83M0kyc3plQlZEbyJdfSwiX3NkIjpbIjRDbDVaZ0trN256V09FZmFXa2xhZ0FqQU53QmRMeDJST25UVUhrS1JZY1UiLCI1amQtYXFEZFRfQnUtV2tGOXNvbW5NeEVISnRyVGxRYlRfRU9Eay1yUlNzIiwiNmZ6NEdoRVp5ZnpaRndNY1dOTF9CVHRwdHNEd3RrV1habjdqTl9rU1FnWSIsIkM3VG1jS1lsVHA0Ty05VnI0SEZ0cUdBQWUwNERHX3Fmcy04MzRpSVJMVG8iLCJQVEprTlByTEw3a3pvcFpPTnZWc2pmaWppSi1rdXc2MW5BTGJUWFpsOFhvIiwiUmd0eHNOSHBVNUZJN0xNa1ktb0Q3ZFZ4eUtNMkc4RUc5aHR2TVJpZFBQRSIsImJ4YUwyQ2tpX3B2VGxhYWRRU0MwMVlhakVQcXlYMzlORFdEU2dCU2RuZlEiXSwiYWRkcmVzcyI6eyJfc2QiOlsiOTZqVjZZXy04d2VtcVgxallMdkN1N3R4dVRRT01LMTczeUdZZ1FtOUNQQSIsIkdZdWk3cHZ4bW8yQXFlblY1WWdCQmtFdGs4WGdzNktiTUZHS0o3T1c3YmciLCJmZHQwWG14OEkyOGRmcm1iQTQtbDl5ZDI5anBWSzhkUFd5clIzQ1ZMWm9JIiwicXJnQzVxM25xZWxlOGpZbVkzQmt6QjBQeEFsdHkxNl9GaHJPa2FGaGtkWSJdfSwiaXNzdWluZ19jb3VudHJ5IjoiREUiLCJ2Y3QiOiJodHRwczovL2V4YW1wbGUuYm1pLmJ1bmQuZGUvY3JlZGVudGlhbC9waWQvMS4wIiwiaXNzdWluZ19hdXRob3JpdHkiOiJERSIsIl9zZF9hbGciOiJzaGEtMjU2IiwiaXNzIjoiaHR0cHM6Ly9kZW1vLnBpZC1pc3N1ZXIuYnVuZGVzZHJ1Y2tlcmVpLmRlL2MxIiwiY25mIjp7Imp3ayI6eyJrdHkiOiJFQyIsImNydiI6IlAtMjU2IiwieCI6Ik5lWF9abml3eERPSkRfS3lxZjY3OFYtWXgzZjMtRFoweUQ5WGVycEZtY2MiLCJ5IjoiZ3BvNUgweldhUE05eWM3TTJyZXg0SVo2R2ViOUoyODQyVDN0Nlg4ZnJBTSJ9fSwiZXhwIjoxNzMzNzA5NTE0LCJpYXQiOjE3MzI0OTk5MTQsImFnZV9lcXVhbF9vcl9vdmVyIjp7Il9zZCI6WyJIbUQtNnlpYVZPWVB6ZG1XTFBteU94enI4cTJnb3VPOUo5VjZVMFBPT1Y0IiwiSW5zX2JNOVZOaUJGV0ZNNXR1NXZ0M3RrWmhaUUJtY25LTUl5QU16dXYxcyIsImE5ZjNPaWp0NHByZGYtV2lvclkxZ09jZEliX1dDc1JwVzlCS2JPb0ZxUW8iLCJlQ19QbG9nMEMtZTJuN0s0WVNuU3NBQjRLS1dUdmxnMlpkOXhEQm1pRDVnIiwib2E2UVV5SGxQbmU5QW1tT29KTjdFQ1AwRHpEZy1TSVlKUnQtcVNheUxWSSIsInZUZlcwY2VQd0VDQXNUbTVWMFNaZlp6T0lLQUdmRHIyMTlqOWpmaFRIQUUiXX19.m5m6mQQu6O-4Y18VoIiv4mg4Jp5QPd0RStE8hPM_caqWo5prs8spXBB_0NBANGpqnNqEdK2yLRzGidZY8GRNHA~WyI5NmhWUFZxWDJYOU5rUU9IME5WLW5nIiwiZmFtaWx5X25hbWUiLCJNVVNURVJNQU5OIl0~WyJuME1ZOXVodmFCMEZ5YnZkQ2VDNHBnIiwiZ2l2ZW5fbmFtZSIsIkVSSUtBIl0~WyJIYmwzTGZHeXFOaE5rZ05GajZyV2RBIiwiYmlydGhkYXRlIiwiMTk2NC0wOC0xMiJd~WyJPcU9TTEdXNF9JTUdRLUdjRkpSS2pBIiwiYWdlX2JpcnRoX3llYXIiLDE5NjRd~WyJsdGpKV1k2cVM0V1p1bXlTNF9xcW5RIiwiYWdlX2luX3llYXJzIiw2MF0~WyJvVnFxdEY3LXdHSE5xNXJnSURlQTdnIiwiYmlydGhfZmFtaWx5X25hbWUiLCJHQUJMRVIiXQ~WyI2TDZaSjRyN2lCTmdRVjY3SXR1c1JRIiwibmF0aW9uYWxpdGllcyIsWyJERSJdXQ~WyJQLV9LSjhieTQ1NkJpenNWZ2N4UER3IiwiMTIiLHRydWVd~WyIwSmxOY0ZYd1FUYmMzMUF0SGlhY1lBIiwiMTQiLHRydWVd~WyJldjR6UE85ckZZc3QtRE55V2hzMVZRIiwiMTYiLHRydWVd~WyJ1OWxaSzljaE4wWVJWV082ZG9ySThRIiwiMTgiLHRydWVd~WyJnWkZqMUhmRS12azJFNmEzTzRESl93IiwiMjEiLHRydWVd~WyJweGNQWWIzZEFkYnhLMTdTUXR4SWRRIiwiNjUiLGZhbHNlXQ~WyJHU25uUnF0T2p0dl9FMk1Qd3l1bFZRIiwibG9jYWxpdHkiLCJCRVJMSU4iXQ~WyJoRmJNbnZGSWhtUXNpanpUT1Q1VFVnIiwibG9jYWxpdHkiLCJLw5ZMTiJd~WyJUc3lxN3RSSm9LMmEzeF9PWFlmMWp3IiwiY291bnRyeSIsIkRFIl0~WyJLQUwyVHFfSlZRLS1PMXBzYUJtSzhBIiwicG9zdGFsX2NvZGUiLCI1MTE0NyJd~WyJ4SFVxVkNwaGNSdVJYSVRZbDZsSndnIiwic3RyZWV0X2FkZHJlc3MiLCJIRUlERVNUUkHhup5FIDE3Il0~'
