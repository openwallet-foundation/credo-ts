import { type Mac0Context } from '@owf/cose'
import type { AgentContext } from '../../../agent'
import { CredoError } from '../../../error'
import { KeyManagementApi, type KnownJwaSignatureAlgorithm } from '../../kms'

export const getMac0Context = (agentContext: AgentContext): Mac0Context => {
  const kms = agentContext.resolve(KeyManagementApi)

  return {
    mac: async (input) => {
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
  } satisfies Mac0Context
}
