import type { MdocContext, X509Context } from '@animo-id/mdoc'
import { p256 } from '@noble/curves/nist.js'
import { hkdf } from '@noble/hashes/hkdf.js'
import { sha256 } from '@noble/hashes/sha2.js'
import type { AgentContext } from '../../agent'
import { CredoWebCrypto, Hasher } from '../../crypto'
import { TypedArrayEncoder } from '../../utils'
import { KeyManagementApi, type KmsJwkPublicAsymmetric, type KnownJwaSignatureAlgorithm, PublicJwk } from '../kms'
import { X509Certificate, X509Service } from '../x509'

export const getMdocContext = (agentContext: AgentContext): MdocContext => {
  const crypto = new CredoWebCrypto(agentContext)
  const kms = agentContext.resolve(KeyManagementApi)

  return {
    crypto: {
      digest: async (input) => {
        const { bytes, digestAlgorithm } = input

        return new Uint8Array(
          crypto.digest(
            digestAlgorithm,
            // NOTE: extra Uint8Array wrapping is needed here, somehow if we use `bytes.buffer` directly
            // it's not working. Maybe due to Uint8array lengt
            new Uint8Array(bytes).buffer
          )
        )
      },
      random: (length) => {
        return crypto.getRandomValues(new Uint8Array(length))
      },
      calculateEphemeralMacKeyJwk: async (input) => {
        const { privateKey, publicKey, sessionTranscriptBytes } = input
        const ikm = p256.getSharedSecret(privateKey, publicKey, true).slice(1)
        const salt = Hasher.hash(sessionTranscriptBytes, 'sha-256')
        const info = TypedArrayEncoder.fromString('EMacKey')
        const hk1 = hkdf(sha256, ikm, salt, info, 32)

        return {
          key_ops: ['sign', 'verify'],
          ext: true,
          kty: 'oct',
          k: TypedArrayEncoder.toBase64URL(hk1),
          alg: 'HS256',
        }
      },
    },

    cose: {
      mac0: {
        sign: async (input) => {
          const { jwk, mac0 } = input
          const { data } = mac0.getRawSigningData()

          const publicJwk = PublicJwk.fromUnknown(jwk)
          const algorithm = mac0.algName ?? publicJwk.signatureAlgorithm

          const { signature } = await kms.sign({
            data,
            algorithm,
            keyId: publicJwk.keyId,
          })

          return signature
        },
        verify: async (input) => {
          const { mac0, jwk, options } = input
          const { data, signature } = mac0.getRawVerificationData(options)

          const publicJwk = PublicJwk.fromUnknown(jwk)
          const algorithm = mac0.algName ?? publicJwk.signatureAlgorithm

          const { verified } = await kms.verify({
            key: {
              publicJwk: jwk as KmsJwkPublicAsymmetric,
            },
            data,
            algorithm,
            signature,
          })

          return verified
        },
      },
      sign1: {
        sign: async (input) => {
          const { jwk, sign1 } = input
          const { data } = sign1.getRawSigningData()

          const publicJwk = PublicJwk.fromUnknown(jwk)
          const algorithm = sign1.algName ?? publicJwk.signatureAlgorithm

          const { signature } = await kms.sign({
            data,
            algorithm: algorithm as KnownJwaSignatureAlgorithm,
            keyId: publicJwk.keyId,
          })

          return signature
        },
        verify: async (input) => {
          const { sign1, jwk, options } = input
          const { data, signature } = sign1.getRawVerificationData(options)

          const publicJwk = PublicJwk.fromUnknown(jwk)
          const algorithm = sign1.algName ?? publicJwk.signatureAlgorithm

          const { verified } = await kms.verify({
            key: {
              publicJwk: jwk as KmsJwkPublicAsymmetric,
            },
            data,
            algorithm: algorithm as KnownJwaSignatureAlgorithm,
            signature,
          })

          return verified
        },
      },
    },

    x509: {
      getIssuerNameField: (input) => {
        const { certificate, field } = input
        const x509Certificate = X509Certificate.fromRawCertificate(certificate)
        return x509Certificate.getIssuerNameField(field)
      },
      getPublicKey: async (input) => {
        const certificate = X509Certificate.fromRawCertificate(input.certificate)
        return certificate.publicJwk.toJson()
      },
      validateCertificateChain: async (input) => {
        const certificateChain = input.x5chain.map((cert) => X509Certificate.fromRawCertificate(cert).toString('pem'))
        const trustedCertificates = input.trustedCertificates.map((cert) =>
          X509Certificate.fromRawCertificate(cert).toString('pem')
        ) as [string, ...string[]]

        await X509Service.validateCertificateChain(agentContext, {
          certificateChain,
          trustedCertificates,
        })
      },
      getCertificateData: async (input) => {
        const { certificate } = input
        const x509Certificate = X509Certificate.fromRawCertificate(certificate)
        return {
          ...x509Certificate.data,
          thumbprint: await x509Certificate.getThumbprintInHex(agentContext),
        }
      },
    } satisfies X509Context,
  }
}
