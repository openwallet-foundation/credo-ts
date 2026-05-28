import type { Sign1Context } from '@owf/cose'
import { CoseKey } from '@owf/mdoc'
import type { AgentContext } from '../../agent'
import { CredoError } from '../../error'
import {
  KeyManagementApi,
  type KmsJwkPublicAsymmetric,
  type KnownCoseSignatureAlgorithm,
  knownJwaFromCoseSignatureAlgorithm,
  PublicJwk,
} from '../../modules/kms'
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
        algorithm: knownJwaFromCoseSignatureAlgorithm(input.algorithm as KnownCoseSignatureAlgorithm),
        keyId: input.key.keyId,
      })

      return signature
    },
    verify: async (input) => {
      const algorithm = input.algorithm ?? input.key.algorithm
      const jwaAlgorithm = algorithm
        ? knownJwaFromCoseSignatureAlgorithm(algorithm as KnownCoseSignatureAlgorithm)
        : PublicJwk.fromUnknown(input.key.jwk).signatureAlgorithm

      const { verified } = await kms.verify({
        key: {
          publicJwk: input.key.jwk as KmsJwkPublicAsymmetric,
        },
        data: input.toBeVerified,
        algorithm: jwaAlgorithm,

        signature: input.signature,
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
