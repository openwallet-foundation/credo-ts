import type { AgentContext } from '@credo-ts/core'
import { CredoError, Kms } from '@credo-ts/core'
import { selectJwaSignatureAlgorithm } from '../signatureAlgorithm'

/**
 * Builds an agent context whose key management api only supports signing with `supportedAlgs`.
 */
function getAgentContextWithSigningAlgs(supportedAlgs: Kms.KnownJwaSignatureAlgorithm[]): AgentContext {
  return {
    dependencyManager: {
      resolve: () => ({
        supportedJwaSignatureAlgorithms: () => supportedAlgs,
      }),
    },
  } as unknown as AgentContext
}

/**
 * Builds a minimal stand-in for a public jwk supporting `supportedSignatureAlgorithms`.
 */
function getPublicJwk(supportedSignatureAlgorithms: Kms.KnownJwaSignatureAlgorithm[]): Kms.PublicJwk {
  return {
    supportedSignatureAlgorithms,
    jwkTypeHumanDescription: 'test key',
  } as unknown as Kms.PublicJwk
}

describe('selectJwaSignatureAlgorithm', () => {
  test('returns the first algorithm supported by both the key and the agent', () => {
    const agentContext = getAgentContextWithSigningAlgs([Kms.KnownJwaSignatureAlgorithms.ES256])
    const publicJwk = getPublicJwk([Kms.KnownJwaSignatureAlgorithms.EdDSA, Kms.KnownJwaSignatureAlgorithms.ES256])

    // EdDSA comes first on the key, but the agent cannot sign with it
    expect(selectJwaSignatureAlgorithm(agentContext, { publicJwk })).toBe(Kms.KnownJwaSignatureAlgorithms.ES256)
  })

  test('throws when the key and the agent have no algorithm in common', () => {
    const agentContext = getAgentContextWithSigningAlgs([Kms.KnownJwaSignatureAlgorithms.ES256])
    const publicJwk = getPublicJwk([Kms.KnownJwaSignatureAlgorithms.EdDSA])

    expect(() => selectJwaSignatureAlgorithm(agentContext, { publicJwk })).toThrow(CredoError)
    expect(() => selectJwaSignatureAlgorithm(agentContext, { publicJwk })).toThrow(
      /No JWS signature alg supported by both/
    )
  })

  test('returns a requested algorithm supported by both', () => {
    const agentContext = getAgentContextWithSigningAlgs([
      Kms.KnownJwaSignatureAlgorithms.EdDSA,
      Kms.KnownJwaSignatureAlgorithms.ES256,
    ])
    const publicJwk = getPublicJwk([Kms.KnownJwaSignatureAlgorithms.EdDSA, Kms.KnownJwaSignatureAlgorithms.ES256])

    expect(
      selectJwaSignatureAlgorithm(agentContext, {
        publicJwk,
        requestedAlg: Kms.KnownJwaSignatureAlgorithms.EdDSA,
      })
    ).toBe(Kms.KnownJwaSignatureAlgorithms.EdDSA)
  })

  test('throws when a requested algorithm is not supported by the key', () => {
    const agentContext = getAgentContextWithSigningAlgs([
      Kms.KnownJwaSignatureAlgorithms.EdDSA,
      Kms.KnownJwaSignatureAlgorithms.ES256,
    ])
    const publicJwk = getPublicJwk([Kms.KnownJwaSignatureAlgorithms.ES256])

    expect(() =>
      selectJwaSignatureAlgorithm(agentContext, {
        publicJwk,
        requestedAlg: Kms.KnownJwaSignatureAlgorithms.EdDSA,
      })
    ).toThrow(/does not support the JWS signature alg 'EdDSA'/)
  })

  test('throws when a requested algorithm is supported by the key but not by the agent', () => {
    const agentContext = getAgentContextWithSigningAlgs([Kms.KnownJwaSignatureAlgorithms.ES256])
    const publicJwk = getPublicJwk([Kms.KnownJwaSignatureAlgorithms.EdDSA, Kms.KnownJwaSignatureAlgorithms.ES256])

    expect(() =>
      selectJwaSignatureAlgorithm(agentContext, {
        publicJwk,
        requestedAlg: Kms.KnownJwaSignatureAlgorithms.EdDSA,
      })
    ).toThrow(/no key management backend able to sign with alg 'EdDSA'/)
  })
})
