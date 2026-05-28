import { type Mac0Context } from '@owf/cose'
import type { AgentContext } from '../../agent'
import { CredoError } from '../../error'
import {
  KeyManagementApi,
  type KmsJwkPublicAsymmetric,
  type KnownCoseSignatureAlgorithm,
  knownJwaFromCoseSignatureAlgorithm,
  PublicJwk,
} from '../../modules/kms'

export const getMac0Context = (agentContext: AgentContext): Mac0Context => {
  const kms = agentContext.resolve(KeyManagementApi)

  return {
    authenticate: async (input) => {
      if (input.key instanceof Uint8Array) {
        throw new CredoError('For mdoc authentication with mac0 a CoseKey is required, not a Uint8Array')
      }
      if (!input.key.keyId) {
        throw new CredoError('Missing required keyId on CoseKey for signing mdoc')
      }

      const algorithm = input.key.algorithm
      const jwaAlgorithm = input.key.algorithm
        ? knownJwaFromCoseSignatureAlgorithm(algorithm as KnownCoseSignatureAlgorithm)
        : PublicJwk.fromUnknown(input.key.jwk).signatureAlgorithm

      const { signature } = await kms.sign({
        data: input.toBeAuthenticated,
        algorithm: jwaAlgorithm,
        keyId: input.key.keyId,
      })

      return signature
    },
    verify: async (input) => {
      const { tag, toBeAuthenticated, key } = input
      if (key instanceof Uint8Array) {
        throw new CredoError('For mdoc authentication verification with mac0 a CoseKey is required, not a Uint8Array')
      }

      const algorithm = input.algorithm ?? key.algorithm
      const jwaAlgorithm = algorithm
        ? knownJwaFromCoseSignatureAlgorithm(algorithm as KnownCoseSignatureAlgorithm)
        : PublicJwk.fromUnknown(key.jwk).signatureAlgorithm

      const { verified } = await kms.verify({
        key: {
          publicJwk: key.jwk as KmsJwkPublicAsymmetric,
        },
        data: toBeAuthenticated,
        algorithm: jwaAlgorithm,
        signature: tag,
      })

      return verified
    },
  } satisfies Mac0Context
}
