import { AgentContext, CredoError, Kms } from '@credo-ts/core'
import type { RequestDpopOptions } from '@openid4vc/oauth2'
import { getJwkSigner } from './utils'

export async function getDpopOptions(
  agentContext: AgentContext,
  options: {
    dpopSigningAlgValuesSupported: string[]
    signingAlgValuesSupported?: Kms.KnownJwaSignatureAlgorithm[]
    keyId?: string
    kmsBackend?: string
    jwk?: Kms.PublicJwk
    nonce?: string
  }
): Promise<RequestDpopOptions> {
  const kms = agentContext.resolve(Kms.KeyManagementApi)
  const publicJwk = options.jwk
    ? options.jwk
    : options.keyId
      ? await kms.getPublicKey({ keyId: options.keyId, backend: options.kmsBackend }).then(({ publicKey, backend }) => {
          if (!publicKey || publicKey.kty === 'oct') {
            throw new CredoError(`Unable to resolve DPoP key '${options.keyId}'.`)
          }
          return Kms.PublicJwk.fromKmsKey({ publicJwk: publicKey, keyId: options.keyId as string, backend })
        })
      : undefined
  const algorithms = options.dpopSigningAlgValuesSupported.filter(
    (algorithm) => options.signingAlgValuesSupported?.includes(algorithm as Kms.KnownJwaSignatureAlgorithm) ?? true
  )

  const alg = publicJwk
    ? algorithms.find((algorithm) =>
        publicJwk.supportedSignatureAlgorithms.includes(algorithm as Kms.KnownJwaSignatureAlgorithm)
      )
    : algorithms.find((algorithm): algorithm is Kms.KnownJwaSignatureAlgorithm => {
        try {
          const knownAlgorithm = algorithm as Kms.KnownJwaSignatureAlgorithm
          return (
            Kms.PublicJwk.supportedPublicJwkClassForSignatureAlgorithm(knownAlgorithm) &&
            kms.supportedBackendsForOperation({ operation: 'sign', algorithm: knownAlgorithm }).length > 0
          )
        } catch {
          return false
        }
      })

  if (!alg) {
    throw new CredoError(
      `No supported dpop signature algorithms found in dpop_signing_alg_values_supported '${options.dpopSigningAlgValuesSupported.join(
        ', '
      )}'`
    )
  }

  const resolvedPublicJwk: Kms.PublicJwk =
    publicJwk ??
    Kms.PublicJwk.fromKmsKey(
      await kms.createKeyForSignatureAlgorithm({ algorithm: alg as Kms.KnownJwaSignatureAlgorithm })
    )
  // RFC 9449 doesn't need a `kid` in the DPoP `jwk` header
  return { signer: getJwkSigner(resolvedPublicJwk, alg), nonce: options.nonce }
}
