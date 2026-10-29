import { AgentContext, CredoError, Kms } from '@credo-ts/core'
import { calculateJwkThumbprint, HashAlgorithm, type Jwk, type RequestDpopOptions } from '@openid4vc/oauth2'
import { getOid4vcCallbacks } from './callbacks'

export async function getDpopOptions(
  agentContext: AgentContext,
  options: {
    dpopSigningAlgValuesSupported: string[]
    signingAlgValuesSupported?: Kms.KnownJwaSignatureAlgorithm[]
    keyId?: string
    jwk?: Kms.PublicJwk
    nonce?: string
  }
) {
  const kms = agentContext.resolve(Kms.KeyManagementApi)
  const publicJwk = options.jwk
    ? options.jwk
    : options.keyId
      ? await kms.getPublicKey({ keyId: options.keyId }).then((key) => {
          if (!key || key.kty === 'oct') throw new CredoError(`Unable to resolve DPoP key '${options.keyId}'.`)
          return Kms.PublicJwk.fromPublicJwk(key)
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

  const resolvedPublicJwk =
    publicJwk ??
    Kms.PublicJwk.fromPublicJwk(
      (await kms.createKeyForSignatureAlgorithm({ algorithm: alg as Kms.KnownJwaSignatureAlgorithm })).publicJwk
    )
  const jwk = resolvedPublicJwk.toJson() as Jwk
  const callbacks = getOid4vcCallbacks(agentContext)
  const dpopOptions = {
    signer: { method: 'jwk', alg, publicJwk: jwk },
    nonce: options.nonce,
  } satisfies RequestDpopOptions

  return {
    options: dpopOptions,
    jwkThumbprint: await calculateJwkThumbprint({
      hashAlgorithm: HashAlgorithm.Sha256,
      hashCallback: callbacks.hash,
      jwk,
    }),
    keyId: resolvedPublicJwk.keyId,
    alg: alg as Kms.KnownJwaSignatureAlgorithm,
  }
}
