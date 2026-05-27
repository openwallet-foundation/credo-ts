import { type Mac0Context } from '@owf/cose'
import type { AgentContext } from '../../agent'
import { CredoError } from '../../error'
import {
  KeyManagementApi,
  type KmsJwkPublicAsymmetric,
  type KnownJwaSignatureAlgorithm,
  knownJwaFromCoseSignatureAlgorithm,
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

      const { signature } = await kms.sign({
        data: input.toBeAuthenticated,
        // FIXME: input needs to provide the algorithm
        algorithm: input.key.algorithm as unknown as KnownJwaSignatureAlgorithm,
        keyId: input.key.keyId,
      })

      return signature
    },
    verify: async (input) => {
      const { mac0, key } = input
      if (key instanceof Uint8Array) {
        throw new CredoError('For mdoc authentication verification with mac0 a CoseKey is required, not a Uint8Array')
      }

      const algorithm = knownJwaFromCoseSignatureAlgorithm(mac0.signatureAlgorithmName)

      const { verified } = await kms.verify({
        key: {
          publicJwk: key.jwk as KmsJwkPublicAsymmetric,
        },
        data: mac0.toBeAuthenticated,
        algorithm,
        signature: mac0.tag,
      })

      return verified
    },
  } satisfies Mac0Context
}
