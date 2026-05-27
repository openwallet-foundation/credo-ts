import type { Sign1Context } from '@owf/cose'
import { coseKeyToJwkClaim } from '@owf/cose'
import { CoseKey } from '@owf/mdoc'
import type { AgentContext } from '../../agent'
import { CredoError } from '../../error'
import { KeyManagementApi, type KmsJwkPublicAsymmetric, type KnownJwaSignatureAlgorithm } from '../../modules/kms'
import { X509Certificate } from '../../modules/x509'

export const getSign1Context = (agentContext: AgentContext): Sign1Context => {
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
        const x509Certificate = X509Certificate.fromRawCertificate(input.certificate)
        return x509Certificate.getIssuerNameField(input.field)
      },
      getPublicKey: async (input) => {
        const certificate = X509Certificate.fromRawCertificate(input.certificate)
        return CoseKey.fromJwk(certificate.publicJwk.toJson())
      },
    },
  } satisfies Sign1Context
}
