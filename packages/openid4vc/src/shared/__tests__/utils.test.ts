import { generateKeyPairSync } from 'node:crypto'
import { Kms, X509ModuleConfig, X509Service } from '@credo-ts/core'
import type { IssuerMetadataResult } from '@openid4vc/openid4vci'
import { getAgentContext } from '../../../../core/tests'
import {
  type CredoJwtSigner,
  credoJwtIssuerToOpenId4VcJwtIssuer,
  decodeJwtIssuer,
  encodeJwtIssuer,
  getCredentialRequestEncryption,
  getSupportedEncryptionJwks,
  selectCredentialRequestEncryption,
} from '../utils'

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

describe('getSupportedEncryptionJwks', () => {
  test('only returns the jwks that can be used for key agreement by the kms backends', () => {
    const agentContext = getAgentContext({ kmsBackends: [p256OnlyBackend] })

    const p256 = ecJwk('P-256')
    const p384 = ecJwk('P-384')
    const p521 = ecJwk('P-521')

    expect(getSupportedEncryptionJwks(agentContext, { keys: [p521, p384, p256] as never })).toEqual({
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
      getSupportedEncryptionJwks(agentContext, {
        keys: [ed25519, x25519, p256, p521, { kty: 'oct', k: 'aGVsbG8' }] as never,
      })
    ).toEqual({
      keys: [x25519, p256, p521],
    })
  })
})

describe('getCredentialRequestEncryption', () => {
  const metadata = (credentialRequestEncryption: Record<string, unknown>) =>
    ({
      credentialIssuer: {
        credential_issuer: 'https://issuer.example',
        credential_request_encryption: credentialRequestEncryption,
      },
    }) as unknown as IssuerMetadataResult

  test('picks the first issuer key and enc value supported by the agent', () => {
    const agentContext = getAgentContext({ kmsBackends: [p256OnlyBackend] })
    const keys = [
      { ...ecJwk('P-256'), kid: 'signing', use: 'sig', alg: 'ECDH-ES' },
      { ...ecJwk('P-256'), kid: 'rsa', alg: 'RSA-OAEP-256' },
      { ...ecJwk('P-384'), kid: 'p384', alg: 'ECDH-ES' },
      { ...ecJwk('P-256'), kid: 'p256', use: 'enc', alg: 'ECDH-ES' },
    ]

    expect(
      getCredentialRequestEncryption(
        agentContext,
        metadata({
          jwks: { keys },
          enc_values_supported: ['A192GCM', 'A256GCM', 'A128GCM'],
          encryption_required: true,
        }),
        false
      )
    ).toEqual({ kid: 'p256', enc: 'A128GCM' })
  })

  test('does not choose a key when the request is not encrypted', () => {
    const agentContext = getAgentContext()
    const keys = [{ ...ecJwk('P-256'), kid: 'p256', alg: 'ECDH-ES' }]

    expect(
      getCredentialRequestEncryption(
        agentContext,
        metadata({ jwks: { keys }, enc_values_supported: ['A128GCM'], encryption_required: false }),
        false
      )
    ).toBeUndefined()
  })

  test('throws when the issuer advertises no usable key', () => {
    const agentContext = getAgentContext({ kmsBackends: [p256OnlyBackend] })
    const keys = [{ ...ecJwk('P-384'), kid: 'p384', alg: 'ECDH-ES' }]

    expect(() =>
      getCredentialRequestEncryption(
        agentContext,
        metadata({ jwks: { keys }, enc_values_supported: ['A128GCM'], encryption_required: false }),
        true
      )
    ).toThrow("Credential issuer 'https://issuer.example' does not advertise a credential request encryption key")
  })
})

describe('selectCredentialRequestEncryption', () => {
  test('returns undefined instead of throwing when the issuer advertises no usable key', () => {
    const agentContext = getAgentContext({ kmsBackends: [p256OnlyBackend] })

    expect(
      selectCredentialRequestEncryption(agentContext, {
        credentialIssuer: {
          credential_issuer: 'https://issuer.example',
          credential_request_encryption: {
            jwks: { keys: [{ ...ecJwk('P-384'), kid: 'p384', alg: 'ECDH-ES' }] },
            enc_values_supported: ['A128GCM'],
            encryption_required: false,
          },
        },
      } as unknown as IssuerMetadataResult)
    ).toBeUndefined()
  })
})

describe('encodeJwtIssuer', () => {
  test('keeps the kms backend of an x5c signer, also in the signer it creates', async () => {
    const agentContext = getAgentContext({ registerInstances: [[X509ModuleConfig, new X509ModuleConfig()]] })
    const kms = agentContext.resolve(Kms.KeyManagementApi)
    const authorityKey = Kms.PublicJwk.fromKmsKey(await kms.createKey({ type: { kty: 'EC', crv: 'P-256' } }))
    const certificate = await X509Service.createCertificate(agentContext, { authorityKey, issuer: 'C=NL' })

    const encoded = encodeJwtIssuer({ method: 'x5c', x5c: [certificate] })
    expect(encoded).toMatchObject({ leafCertificateKeyId: authorityKey.keyId, leafCertificateKmsBackend: 'node' })

    const signer = await credoJwtIssuerToOpenId4VcJwtIssuer(agentContext, decodeJwtIssuer(agentContext, encoded))
    expect((signer as CredoJwtSigner).kmsBackend).toBe('node')
  })

  test('stores the key id and backend of a jwk signer next to the jwk, and decodes signers that have it as kid', async () => {
    const agentContext = getAgentContext()
    const kms = agentContext.resolve(Kms.KeyManagementApi)
    const jwk = Kms.PublicJwk.fromKmsKey(await kms.createKey({ type: { kty: 'EC', crv: 'P-256' } }))

    const encoded = encodeJwtIssuer({ method: 'jwk', jwk })
    expect(encoded).toEqual({
      method: 'jwk',
      jwk: jwk.toJson({ includeKid: false }),
      keyId: jwk.keyId,
      kmsBackend: 'node',
    })

    const decoded = decodeJwtIssuer(agentContext, encoded)
    const decodedWithKid = decodeJwtIssuer(agentContext, { method: 'jwk', jwk: jwk.toJson() })
    expect(decoded.method === 'jwk' && decoded.jwk.keyId).toBe(jwk.keyId)
    expect(decodedWithKid.method === 'jwk' && decodedWithKid.jwk.keyId).toBe(jwk.keyId)
  })

  test('creates a jwk signer whose public jwk has no kid, and that signs with the KMS key id and backend', async () => {
    const agentContext = getAgentContext()
    const kms = agentContext.resolve(Kms.KeyManagementApi)
    const jwk = Kms.PublicJwk.fromKmsKey(await kms.createKey({ type: { kty: 'EC', crv: 'P-256' } }))

    expect(await credoJwtIssuerToOpenId4VcJwtIssuer(agentContext, { method: 'jwk', jwk })).toEqual({
      method: 'jwk',
      alg: 'ES256',
      publicJwk: jwk.toJson({ includeKid: false }),
      kid: jwk.keyId,
      kmsBackend: 'node',
    })
  })
})
