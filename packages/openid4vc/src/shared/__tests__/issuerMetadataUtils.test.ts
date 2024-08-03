import type { Wallet } from '@credo-ts/core'

import { KeyType } from '@credo-ts/core'

import { getAgentContext } from '../../../../core/tests'
import { credentialsSupportedV11ToV13, credentialsSupportedV13ToV11 } from '../issuerMetadataUtils'

const agentContext = getAgentContext({
  wallet: {
    supportedKeyTypes: [KeyType.Ed25519, KeyType.P256],
  } as Wallet,
})

describe('issuerMetadataUtils', () => {
  describe('credentialsSupportedV13toV11', () => {
    test('should correctly transform from v13 to v11 format', () => {
      expect(
        credentialsSupportedV13ToV11({
          'pid-sd-jwt': {
            scope: 'pid',
            cryptographic_binding_methods_supported: ['jwk'],
            credential_signing_alg_values_supported: ['ES256'],
            proof_types_supported: {
              jwt: {
                proof_signing_alg_values_supported: ['ES256'],
              },
            },
            vct: 'urn:eu.europa.ec.eudi:pid:1',
            format: 'vc+sd-jwt',
          },
        })
      ).toEqual([
        {
          id: 'pid-sd-jwt',
          scope: 'pid',
          cryptographic_binding_methods_supported: ['jwk'],
          cryptographic_suites_supported: ['ES256'],
          vct: 'urn:eu.europa.ec.eudi:pid:1',
          format: 'vc+sd-jwt',
        },
      ])
    })
  })

  describe('credentialsSupportedV11toV13', () => {
    test('should correctly transform from v11 to v13 format', () => {
      expect(
        credentialsSupportedV11ToV13(agentContext, [
          {
            id: 'pid-sd-jwt',
            scope: 'pid',
            cryptographic_binding_methods_supported: ['jwk'],
            cryptographic_suites_supported: ['ES256'],
            vct: 'urn:eu.europa.ec.eudi:pid:1',
            format: 'vc+sd-jwt',
          },
        ])
      ).toEqual({
        'pid-sd-jwt': {
          scope: 'pid',
          cryptographic_binding_methods_supported: ['jwk'],
          credential_signing_alg_values_supported: ['ES256'],
          proof_types_supported: {
            jwt: {
              proof_signing_alg_values_supported: ['ES256'],
            },
          },
          vct: 'urn:eu.europa.ec.eudi:pid:1',
          format: 'vc+sd-jwt',
          order: undefined,
          display: undefined,
          claims: undefined,
        },
      })
    })
  })
})
