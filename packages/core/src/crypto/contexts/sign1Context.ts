import type { CoseKey, Sign1Context } from '@owf/cose'
import type { AgentContext } from '../../agent'
import { CredoError } from '../../error'
import {
  KeyManagementApi,
  type KmsJwkPublicAsymmetric,
  type KmsKeyReference,
  type KnownCoseSignatureAlgorithm,
  knownJwaFromCoseSignatureAlgorithm,
  PublicJwk,
} from '../../modules/kms'

/**
 * The KMS key to use for a `CoseKey`: the key in `keys` with the same public key. The `keyId` of the `CoseKey` is
 * never used, as the mdoc library writes it into the `kid` header.
 */
export function getKmsKeyForCoseKey(keys: PublicJwk[], coseKey: CoseKey): KmsKeyReference {
  const publicJwk = keys.length > 0 ? PublicJwk.fromUnknown(coseKey.jwk) : undefined
  const key = publicJwk ? keys.find((key) => key.hasKeyId && key.equals(publicJwk)) : undefined
  if (key) return { keyId: key.keyId, kmsBackend: key.kmsBackend }

  throw new CredoError('No KMS key found for COSE key. Pass the key with its key id to the context.')
}

/**
 * @param keys the keys that sign, from `PublicJwk.fromKmsKey`, found by their public key.
 */
export const getSign1Context = (agentContext: AgentContext, keys: PublicJwk[] = []): Sign1Context => {
  const kms = agentContext.resolve(KeyManagementApi)

  return {
    sign: async (input) => {
      const { keyId, kmsBackend } = getKmsKeyForCoseKey(keys, input.key)

      const algorithm = input.algorithm ?? input.key.algorithm
      if (algorithm === undefined) {
        throw new CredoError('Unable to sign COSE Sign1 structure. No algorithm provided or defined on the COSE key.')
      }

      const { signature } = await kms.sign({
        data: input.toBeSigned,
        algorithm: knownJwaFromCoseSignatureAlgorithm(algorithm as KnownCoseSignatureAlgorithm),
        keyId,
        backend: kmsBackend,
        expectedPublicJwk: input.key.jwk as KmsJwkPublicAsymmetric,
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
