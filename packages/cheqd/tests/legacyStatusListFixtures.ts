/**
 * Status lists as stored on the cheqd testnet by Veramo and @cheqd/did-provider-cheqd (read on 11 Nov 2026). They are public data:
 * `data` is each resource body exactly as stored.
 */
export const legacyStatusListFixtures = {
  bitstring: {
    collectionId: '11ceabbd-1fdc-46c0-a15d-534c07926d2b',
    resourceId: '289d6ea9-c5bd-4b25-afe2-9277352b34f9',
    name: 'unencrypted-status-list',
    resourceType: 'BitstringStatusListCredential',
    version: '2026-11-10T08:57:13.952Z',
    data: {
      bitstringStatusListCredential: {
        credentialSubject: {
          type: 'BitstringStatusList',
          statusPurpose: ['revocation', 'suspension', 'message'],
          encodedList:
            'H4sIAAAAAAAAA-3cTU7DMBAFYIJYsOQIWVY9xRwta06BKjbklIRGgarNj43H88b2-4SEGlDy6tpjxy2czpf3j_HqPH8bv6av0_hreni5jLemI-PnE90b0AHCdegAhSisnV7QAcjCm-XFXi0vRgvT15iisMxGOppG62tQQQdIIorn8lHI7ntg2Kwm6jma9YwOQLQQdIAwPkpnVQq7oafyGI1asbmMDg67qnAxl4GgA0RjN3jQowPEebgNVijU3DCmNW7XAD06wGzYOO623WLF7PIOuUKEq29TmiiKqJyl7G2sEstAiZnz8tgiPTpAZST6B1H6x0MqvUo0TjIru9IqY2O0gvtQOI7aXjcKfsXAjTRXqtmHoR35hj2-oKzxmSqvFkdyi8_ZGtvYWrf7UJHjMinoAAh6rzQHLXni6IY6A442otwEHeCQmF7N607a-qpSbEMQ5ebkvThBByiFoAPcctJ5QoHjcoX9D4V1Mbj07TBJD4GxrCXZZaKwuQjG3Zw4b_K5iwW2O6uETTlsUqpMy3-SCV81sJ5csRkqJOgAfm0tNsQyBO0bQn_xsHr5_HTPRir4nHjLVZiacQa25btjCzoAVcjnNAjEovsnY-dQ-Mhjl_AfYyT98oZMJqZ-5dhgcWETgg7QFBbRxnAZYYnDa5_6fJna4L7vLM0U-57UsY31LF_4NnE-jDSgA_wwGK2S_xJUClYJSsYlBsVwcvOYFMPJcyAqzzedISWIAIAAAA',
        },
        issuer: {
          id: 'did:cheqd:testnet:11ceabbd-1fdc-46c0-a15d-534c07926d2b',
        },
        type: ['VerifiableCredential', 'BitstringStatusListCredential'],
        '@context': ['https://www.w3.org/2018/credentials/v1'],
        issuanceDate: '2025-07-22T13:59:18.000Z',
        proof: {
          type: 'JwtProof2020',
          jwt: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJ2YyI6eyJAY29udGV4dCI6WyJodHRwczovL3d3dy53My5vcmcvMjAxOC9jcmVkZW50aWFscy92MSJdLCJ0eXBlIjpbIlZlcmlmaWFibGVDcmVkZW50aWFsIiwiQml0c3RyaW5nU3RhdHVzTGlzdENyZWRlbnRpYWwiXSwiY3JlZGVudGlhbFN1YmplY3QiOnsidHlwZSI6IkJpdHN0cmluZ1N0YXR1c0xpc3QiLCJzdGF0dXNQdXJwb3NlIjpbInJldm9jYXRpb24iLCJzdXNwZW5zaW9uIiwibWVzc2FnZSJdfX0sIm5iZiI6MTc1MzE5Mjc1OCwiaXNzIjoiZGlkOmNoZXFkOnRlc3RuZXQ6MTFjZWFiYmQtMWZkYy00NmMwLWExNWQtNTM0YzA3OTI2ZDJiIn0.Vcvt5QfPeeTWhfe6vtzIS6_H6bqj54_SIZe-7e034dy4Ug_VRLvwDgH5yOMPqr-U-w0QV2-hkRFLxQVjJ3-TBQ',
        },
      },
      metadata: {
        encrypted: false,
        encoding: 'base64url',
        length: 131072,
        statusSize: 2,
        statusMessages: [
          {
            status: '0x0',
            message: 'valid',
          },
          {
            status: '0x1',
            message: 'revoked',
          },
          {
            status: '0x2',
            message: 'suspended',
          },
          {
            status: '0x3',
            message: 'unknown',
          },
        ],
      },
    },
  },
  statusList2021Revocation: {
    collectionId: '5RpEg66jhhbmASWPXJRWrA',
    resourceId: '4131a6bf-3596-4a15-9e3b-5a5da570b5f6',
    name: 'testingstatuslist',
    resourceType: 'StatusList2021Revocation',
    version: '2026-11-10T17:24:08.296Z',
    data: {
      StatusList2021: {
        statusPurpose: 'revocation',
        encodedList:
          'H4sIAAAAAAAAA-1aPa7bMAx2DA8ZjU4dNXTKKTgXKPAKPC-dehT2Gt1b9PlOvUtr508_lERSdJKi-R7wnEjkR4oiaSVxN32eXg7zPE_Th9_Tl_nHNE0v8_y2XKeXafrYz_OveX6dpk-vh_nnX8HD_H1-WzQ6LoAt2YRdaRIrysAyUWEpk4xiQkqDgBO5ccLAomZRddXAjJQ10gOeW9uBDHl1H8DcDyb29zIswVqYWBS5rqNYxTGwzBrK-m-ApSJKRsxP5XcpsRCygIxNFrwTwuTOk0dFEAleF4J5ImY_S7DXrIuAEY0B2JEAjoKTR3bl7etyThk0hhavukbvvwpGLVJD81DdOQg3GhAyskcIMOR6qNiX0R5IcXnEtefIlyX-TQ5qQFirdZJ7nxiNAG3qynRHQ64s_86yFi_pAN6g47qiRqCdrucyHebu3XNTft8Eplzfck9O4Zjmm1Op6jVtAc34fYBEmESYYdjMlyJeEJSEBYdF7653MXHkRk9qsDpmBDSNqYtt6qkDwFT7hw41Icw_edlEwh0vw1pFcaJF7xm9HHRe5NTkQYt8lJVOS0i3T0xoKTvHvhFnbIDa9FZsPoc4-osyGjhRA-FYfieQEnY2jgBHCCvWMDfxdf1_WuyuaO20_NZeEwc26xoDG30rprpvQ3UEg6vpGTSEO13LxTWeozeuf5boq8YpZHdT_v2PC0ldRoyh3xHpMJYmmxFWEAi1pfJloClbBrlM4RjnyDAANjQRXPiWXxF4vGQKwj7lEuyuzo82BrkcVJCGyvytUa7Q7ban_TsZt_7HZp4jrPcCFDq7i6ZGOwSainVkKmRutLvytBysLCQaTN2BQXE_FYFwfY-EnJkXlSOtMUwOrY2lhxY-3A-YGT9vHHj_faijllIR1JgMLg17Ga0m1H1-3tda5TQpaDXSBQG1Kcntw3y6RTMSrXAzdzrbu2BjqocF0FmhkC5XE-kN2i4W33YCP-NwZhRTCwo4gSzvN46eEqXUyGVV6r3eDlxpspao9VPvRp8JkCUlOpSzPPX3ACTsMqOlctMcQ10Qigs7xnLL8oBPK3TFJS9EuMFn6zPyueAlwDslRRcEzr5A0qyvRG70ZNglE3YjV5HGloWCWjPG6gOVtca7cA74N3J2SOS2B6i0HufR1v8MN-x1mJ9SfuNxdX6jH1KG4BIjn7T74JLHUcCRRn1AzNwCTays2pa_tjh8oODL6WxyGowdtng8riFxgRw1fWZvLBgi0N_um3m4vrysGLVklz7ipB99HuGXiAUbtXGztqp9vpfI5rAn3_D-VYdLhwL_HiVbIshiKDmqjV4KISkBIts03qs16bWko8vG9YV5NcTpC3a2E5y7PaZTA6cXgNRgn9dbxwhHJB0Jc-9YUR-jaxuwKnGGS4dSF4jniqGgEs5dUWtI8sOEo4fH9HVGsogNn5d64oknnrjiDwVcAxdcRAAA',
        validFrom: '2024-07-01T04:23:05.205Z',
      },
      metadata: {
        type: 'StatusList2021Revocation',
        encoding: 'base64url',
        encrypted: false,
      },
    },
  },
  statusList2021Suspension: {
    collectionId: '5RpEg66jhhbmASWPXJRWrA',
    resourceId: '3f6e305a-0d6a-437b-aa20-6cc2ced754f4',
    name: 'testingstatuslist',
    resourceType: 'StatusList2021Suspension',
    version: '2026-11-10T08:58:49.635Z',
    data: {
      StatusList2021: {
        statusPurpose: 'suspension',
        encodedList:
          'H4sIAAAAAAAAA-3asQ3AIBAEQUzkkBIohf6rcgOWccQhMROe9NIW8KXMXa_r_eMSAAAAgOOMdAAAAADsp6YDWKOlA2BHPR0AALCUL3sAzjXSAQAAAHx4AE7b2DJcRAAA',
        validFrom: '2024-07-01T04:24:27.799Z',
      },
      metadata: {
        type: 'StatusList2021Suspension',
        encoding: 'base64url',
        encrypted: false,
      },
    },
  },
} as const
