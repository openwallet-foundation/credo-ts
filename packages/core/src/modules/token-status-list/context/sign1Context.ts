import type { Sign1Context } from '@owf/cose'
import { coseKeyToJwkClaim } from '@owf/cose'
import { CoseKey } from '@owf/mdoc'
import type { AgentContext } from '../../../agent'
import { CredoError } from '../../../error'
import { KeyManagementApi, type KmsJwkPublicAsymmetric, type KnownJwaSignatureAlgorithm } from '../../kms'
import { X509Certificate } from '../../x509'

export const getSign1Context = (agentContext: AgentContext, { now }: { now?: Date } = {}): Sign1Context => {
  const kms = agentContext.resolve(KeyManagementApi)

  return {
    sign: async (input) => {
      if (!input.key.keyId) {
        throw new CredoError('Missing required keyId on CoseKey for signing mdoc')
      }

      const { signature } = await kms.sign({
        data: input.toBeSigned,
        algorithm: coseKeyToJwkClaim.algorithm(input.algorithm),
        keyId: input.key.keyId,
      })

      return signature
    },
    verify: async (input) => {
      if (input.key instanceof Uint8Array) {
        throw new CredoError('For a sign1 signature verification a CoseKey is required, not a Uint8Array')
      }
      const { verified } = await kms.verify({
        key: {
          publicJwk: input.key.jwk as KmsJwkPublicAsymmetric,
        },
        data: input.sign1.toBeSigned,
        algorithm: input.sign1.signatureAlgorithmName as KnownJwaSignatureAlgorithm,
        signature: input.sign1.signature,
      })

      return verified
    },

    x509: {
      getIssuerNameField: (input) => {
        const { certificate, field } = input
        const x509Certificate = X509Certificate.fromRawCertificate(
          certificate instanceof Uint8Array ? certificate : certificate[0]
        )
        return x509Certificate.getIssuerNameField(field)
      },
      getPublicKey: async (input) => {
        const certificate = X509Certificate.fromRawCertificate(
          input.certificate instanceof Uint8Array ? input.certificate : input.certificate[0]
        )
        return CoseKey.fromJwk(certificate.publicJwk.toJson()).publicKey
      },
    },
  } satisfies Sign1Context
}
