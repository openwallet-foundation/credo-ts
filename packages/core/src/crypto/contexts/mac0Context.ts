import { type Mac0Context } from '@owf/cose'
import type { AgentContext } from '../../agent'
import { CredoError } from '../../error'
import {
  KeyManagementApi,
  type KmsJwkPublicAsymmetric,
  type KnownCoseSignatureAlgorithm,
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

      const algorithm = input.algorithm ?? input.key.algorithm
      if (algorithm === undefined) {
        throw new CredoError(
          'Unable to authenticate COSE Mac0 structure. No algorithm provided or defined on the COSE key.'
        )
      }

      const { signature } = await kms.sign({
        data: input.toBeAuthenticated,
        algorithm: knownJwaFromCoseSignatureAlgorithm(algorithm as unknown as KnownCoseSignatureAlgorithm),
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
      if (algorithm === undefined) {
        throw new CredoError(
          'Unable to verify COSE Mac0 structure. No algorithm defined in the protected header or on the COSE key.'
        )
      }

      const { verified } = await kms.verify({
        key: {
          publicJwk: key.jwk as KmsJwkPublicAsymmetric,
        },
        data: toBeAuthenticated,
        algorithm: knownJwaFromCoseSignatureAlgorithm(algorithm as unknown as KnownCoseSignatureAlgorithm),
        signature: tag,
      })

      return verified
    },
  } satisfies Mac0Context
}
