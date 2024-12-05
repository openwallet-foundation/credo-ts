import { JsonTransformer } from '@credo-ts/core'

import { OpenId4VcIssuerRecord } from '../OpenId4VcIssuerRecord'

describe('OpenId4VcIssuerRecord', () => {
  test('should correctly transform credentials supported to credential configurations supported', () => {
    const instance = JsonTransformer.fromJSON(
      {
        credentialsSupported: [
          {
            id: 'd2662472-891c-413d-b3c6-e2f0109001c5',
            format: 'ldp_vc',
            '@context': [],
            types: ['VerifiableCredential', 'OpenBadgeCredential'],
            cryptographic_binding_methods_supported: ['did:key'],
            cryptographic_suites_supported: ['Ed25519Signature2018'],
            display: [
              {
                name: 'Example University Degree',
                description: 'JFF Plugfest 3 OpenBadge Credential',
                background_color: '#464c49',
                logo: {},
              },
            ],
          },
          {
            id: '613ecbbb-0a4c-4041-bb78-c64943139d5f',
            format: 'jwt_vc_json',
            types: ['VerifiableCredential', 'OpenBadgeCredential'],
            cryptographic_binding_methods_supported: ['did:key'],
            cryptographic_suites_supported: ['EdDSA'],
            display: [
              {
                name: 'Example University Degree',
                description: 'JFF Plugfest 3 OpenBadge Credential',
                background_color: '#464c49',
                logo: {},
              },
            ],
          },
          {
            id: '904afaa1-f319-4a12-9c3c-0a6081c3feb0',
            format: 'mso_mdoc',
            doctype: 'some-doc-type',
            cryptographic_binding_methods_supported: ['did:key'],
            cryptographic_suites_supported: ['EdDSA'],
            display: [
              {
                name: 'Passport',
                description: 'Passport of the Kingdom of Kākāpō',
                background_color: '#171717',
                logo: {},
              },
            ],
          },
          {
            id: 'c3db5513-ae2b-46e9-8a0d-fbfd0ce52b6a',
            format: 'vc+sd-jwt',
            vct: 'something',
            cryptographic_binding_methods_supported: ['did:key'],
            cryptographic_suites_supported: ['EdDSA'],
            display: [
              {
                name: 'Passport',
                description: 'Passport of the Kingdom of Kākāpō',
                background_color: '#171717',
                logo: { url: 'https://static.mattr.global/credential-assets/government-of-kakapo/web/logo.svg' },
              },
            ],
          },
        ],
      },
      OpenId4VcIssuerRecord
    )

    expect(instance.credentialConfigurationsSupported).toEqual({
      'd2662472-891c-413d-b3c6-e2f0109001c5': {
        format: 'ldp_vc',
        credential_definition: {
          '@context': [],
          type: ['VerifiableCredential', 'OpenBadgeCredential'],
        },
        cryptographic_binding_methods_supported: ['did:key'],
        credential_signing_alg_values_supported: ['Ed25519Signature2018'],
        display: [
          {
            name: 'Example University Degree',
            description: 'JFF Plugfest 3 OpenBadge Credential',
            background_color: '#464c49',
          },
        ],
      },
      '613ecbbb-0a4c-4041-bb78-c64943139d5f': {
        format: 'jwt_vc_json',
        credential_definition: {
          type: ['VerifiableCredential', 'OpenBadgeCredential'],
        },
        cryptographic_binding_methods_supported: ['did:key'],
        credential_signing_alg_values_supported: ['EdDSA'],
        display: [
          {
            name: 'Example University Degree',
            description: 'JFF Plugfest 3 OpenBadge Credential',
            background_color: '#464c49',
          },
        ],
      },
      '904afaa1-f319-4a12-9c3c-0a6081c3feb0': {
        format: 'mso_mdoc',
        doctype: 'some-doc-type',
        cryptographic_binding_methods_supported: ['did:key'],
        credential_signing_alg_values_supported: ['EdDSA'],
        display: [
          {
            name: 'Passport',
            description: 'Passport of the Kingdom of Kākāpō',
            background_color: '#171717',
          },
        ],
      },
      'c3db5513-ae2b-46e9-8a0d-fbfd0ce52b6a': {
        format: 'vc+sd-jwt',
        vct: 'something',
        cryptographic_binding_methods_supported: ['did:key'],
        credential_signing_alg_values_supported: ['EdDSA'],
        display: [
          {
            name: 'Passport',
            description: 'Passport of the Kingdom of Kākāpō',
            background_color: '#171717',
            logo: { uri: 'https://static.mattr.global/credential-assets/government-of-kakapo/web/logo.svg' },
          },
        ],
      },
    })
  })

  test('does not transform credentials supported to credential configurations supported if already present', () => {
    const instance = JsonTransformer.fromJSON(
      {
        credentialsSupported: [
          {
            id: 'd2662472-891c-413d-b3c6-e2f0109001c5',
            format: 'ldp_vc',
            '@context': [],
            types: ['VerifiableCredential', 'OpenBadgeCredential'],
            cryptographic_binding_methods_supported: ['did:key'],
            cryptographic_suites_supported: ['Ed25519Signature2018'],
            display: [
              {
                name: 'Example University Degree',
                description: 'JFF Plugfest 3 OpenBadge Credential',
                background_color: '#464c49',
                logo: {},
              },
            ],
          },
        ],
        credentialConfigurationsSupported: {},
      },
      OpenId4VcIssuerRecord
    )

    expect(instance.credentialConfigurationsSupported).toEqual({})
  })

  test('should correctly transform display metadata', () => {
    const instance = JsonTransformer.fromJSON(
      {
        display: [
          {
            name: 'hello',
            logo: {
              url: 'https://something.com',
            },
          },
        ],
      },
      OpenId4VcIssuerRecord
    )

    expect(instance.display).toEqual([
      {
        name: 'hello',
        logo: {
          uri: 'https://something.com',
        },
      },
    ])
  })

  test('removes logo if empty objct in display metadata', () => {
    const instance = JsonTransformer.fromJSON(
      {
        display: [
          {
            name: 'hello',
            logo: {},
          },
        ],
      },
      OpenId4VcIssuerRecord
    )

    expect(instance.display).toEqual([
      {
        name: 'hello',
      },
    ])
  })

  test('does not transfrom display metadata if already using uri', () => {
    const instance = JsonTransformer.fromJSON(
      {
        display: [
          {
            name: 'hello',
            logo: {
              uri: 'uri',
            },
          },
        ],
      },
      OpenId4VcIssuerRecord
    )

    expect(instance.display).toEqual([
      {
        name: 'hello',
        logo: {
          uri: 'uri',
        },
      },
    ])
  })
})
