import type { AgentContext } from '@credo-ts/core'
import { CredoError, Kms } from '@credo-ts/core'

export interface SelectJwaSignatureAlgorithmOptions {
  /**
   * The key that will be used to sign.
   */
  publicJwk: Kms.PublicJwk

  /**
   * An optional algorithm supplied by the caller. When provided it is validated against both the key
   * and the agent, rather than trusted as-is.
   */
  requestedAlg?: Kms.KnownJwaSignatureAlgorithm
}

/**
 * Determines the JWA signature algorithm to sign with, from the algorithms supported by both the key
 * and the agent.
 *
 * Taking the first algorithm a key supports is not enough on its own: the agent also needs a key
 * management backend able to sign with it.
 */
export function selectJwaSignatureAlgorithm(
  agentContext: AgentContext,
  { publicJwk, requestedAlg }: SelectJwaSignatureAlgorithmOptions
): Kms.KnownJwaSignatureAlgorithm {
  const agentSupportedAlgs = agentContext.dependencyManager
    .resolve(Kms.KeyManagementApi)
    .supportedJwaSignatureAlgorithms()
  const candidateAlgs = publicJwk.supportedSignatureAlgorithms.filter((algorithm) =>
    agentSupportedAlgs.includes(algorithm)
  )

  if (requestedAlg) {
    if (!publicJwk.supportedSignatureAlgorithms.includes(requestedAlg)) {
      throw new CredoError(
        `jwk ${publicJwk.jwkTypeHumanDescription} does not support the JWS signature alg '${requestedAlg}'.`
      )
    }

    if (!candidateAlgs.includes(requestedAlg)) {
      throw new CredoError(`The agent has no key management backend able to sign with alg '${requestedAlg}'.`)
    }

    return requestedAlg
  }

  const [alg] = candidateAlgs
  if (!alg) {
    throw new CredoError(
      `No JWS signature alg supported by both the agent and the ${publicJwk.jwkTypeHumanDescription} key found.`
    )
  }

  return alg
}
