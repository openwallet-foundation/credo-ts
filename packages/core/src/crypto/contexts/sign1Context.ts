import type { Sign1Context } from '@owf/cose'
import type { AgentContext } from '../../agent'
import { CredoError } from '../../error'
import {
  KeyManagementApi,
  type KmsJwkPublicAsymmetric,
  type KnownCoseSignatureAlgorithm,
  knownJwaFromCoseSignatureAlgorithm,
} from '../../modules/kms'

export const getSign1Context = (agentContext: AgentContext): Sign1Context => {
  const kms = agentContext.resolve(KeyManagementApi)

  return {
    sign: async (input) => {
      if (!input.key.keyId) {
        throw new CredoError('Missing required keyId on CoseKey for signing mdoc')
      }

      const algorithm = input.algorithm ?? input.key.algorithm
      if (algorithm === undefined) {
        throw new CredoError('Unable to sign COSE Sign1 structure. No algorithm provided or defined on the COSE key.')
      }

      const { signature } = await kms.sign({
        data: input.toBeSigned,
        algorithm: knownJwaFromCoseSignatureAlgorithm(algorithm as KnownCoseSignatureAlgorithm),
        keyId: input.key.keyId,
      })

      return signature
    },
    verify: async (input) => {
      if (input.algorithm === undefined) {
        throw new CredoError('Unable to verify COSE Sign1 structure. No algorithm defined in the protected header.')
      }

      const { verified } = await kms.verify({
        key: {
          publicJwk: input.key.jwk as KmsJwkPublicAsymmetric,
        },
        data: input.toBeVerified,
        algorithm: knownJwaFromCoseSignatureAlgorithm(input.algorithm as KnownCoseSignatureAlgorithm),
        signature: input.signature,
      })

      return verified
    },
  } satisfies Sign1Context
}
