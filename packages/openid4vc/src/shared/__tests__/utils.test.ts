import { generateKeyPairSync } from 'node:crypto'
import { Kms } from '@credo-ts/core'
import { getAgentContext } from '../../../../core/tests'
import { getSupportedResponseEncryptionJwks } from '../utils'

const ecJwk = (namedCurve: string) =>
  generateKeyPairSync('ec', { namedCurve }).publicKey.export({ format: 'jwk' }) as Record<string, unknown>
const okpJwk = (type: 'ed25519' | 'x25519') =>
  (type === 'ed25519' ? generateKeyPairSync('ed25519') : generateKeyPairSync('x25519')).publicKey.export({
    format: 'jwk',
  }) as Record<string, unknown>

// Mimics a backend (such as askar) that only supports a subset of the curves
const p256OnlyBackend = {
  backend: 'p256-only',
  isOperationSupported: (_agentContext: unknown, operation: Kms.KmsOperation) => {
    if (operation.operation !== 'encrypt' || operation.keyAgreement?.algorithm !== 'ECDH-ES') return false

    const { externalPublicJwk } = operation.keyAgreement
    return externalPublicJwk.kty === 'EC' && externalPublicJwk.crv === 'P-256'
  },
} as unknown as Kms.KeyManagementService

describe('getSupportedResponseEncryptionJwks', () => {
  test('only returns the jwks that can be used for key agreement by the kms backends', () => {
    const agentContext = getAgentContext({ kmsBackends: [p256OnlyBackend] })

    const p256 = ecJwk('P-256')
    const p384 = ecJwk('P-384')
    const p521 = ecJwk('P-521')

    expect(getSupportedResponseEncryptionJwks(agentContext, { keys: [p521, p384, p256] as never })).toEqual({
      keys: [p256],
    })
  })

  test('filters out jwks that can never be used for ecdh', () => {
    const agentContext = getAgentContext()

    const p256 = ecJwk('P-256')
    const p521 = ecJwk('P-521')
    const x25519 = okpJwk('x25519')
    const ed25519 = okpJwk('ed25519')

    // The node kms does support P-521, so it should not be filtered out here
    expect(
      getSupportedResponseEncryptionJwks(agentContext, {
        keys: [ed25519, x25519, p256, p521, { kty: 'oct', k: 'aGVsbG8' }] as never,
      })
    ).toEqual({
      keys: [x25519, p256, p521],
    })
  })
})
