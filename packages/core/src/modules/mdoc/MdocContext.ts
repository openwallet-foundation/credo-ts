import { p256 } from '@noble/curves/nist.js'
import { hkdf } from '@noble/hashes/hkdf.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { coseKeyToJwkClaim } from '@owf/cose'
import { CoseKey, type MdocContext } from '@owf/mdoc'
import type { AgentContext } from '../../agent'
import { CredoWebCrypto, Hasher } from '../../crypto'
import {
  KeyManagementApi,
  type KmsJwkPublicAsymmetric,
  type KnownJwaSignatureAlgorithm,
  knownJwaFromCoseSignatureAlgorithm,
} from '../kms'
import { X509Certificate, X509Service } from '../x509'
import { MdocError } from './MdocError'

export const getMdocContext = (agentContext: AgentContext, { now }: { now?: Date } = {}): MdocContext => {
  const crypto = new CredoWebCrypto(agentContext)
  const kms = agentContext.resolve(KeyManagementApi)

  return {
    fetch: agentContext.config.agentDependencies.fetch,
    crypto: {
      digest: async (input) => {
        const { bytes, digestAlgorithm } = input

        return new Uint8Array(
          crypto.digest(
            digestAlgorithm,
            // NOTE: extra Uint8Array wrapping is needed here, somehow if we use `bytes.buffer` directly
            // it's not working. Maybe due to Uint8array length
            new Uint8Array(bytes).buffer
          )
        )
      },
      random: (length) => {
        return crypto.getRandomValues(new Uint8Array(length))
      },
      hdkf: async (input) => {
        const { publicKey, privateKey, salt, info, digestAlgorithm } = input
        const ikm = p256.getSharedSecret(privateKey, publicKey, true).slice(1)
        const hashedSalt = Hasher.hash(salt, digestAlgorithm ?? 'sha-256')
        return hkdf(sha256, ikm, hashedSalt, info, 32)
      },
    },

    cose: {
      mac0: {
        sign: async (input) => {
          if (input.key instanceof Uint8Array) {
            throw new MdocError('For mdoc authentication with mac0 a CoseKey is required, not a Uint8Array')
          }
          if (!input.key.keyId) {
            throw new MdocError('Missing required keyId on CoseKey for signing mdoc')
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
            throw new MdocError(
              'For mdoc authentication verification with mac0 a CoseKey is required, not a Uint8Array'
            )
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
      },
      sign1: {
        sign: async (input) => {
          if (!input.key.keyId) {
            throw new MdocError('Missing required keyId on CoseKey for signing mdoc')
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
            throw new MdocError('For mdoc signature verification with sign1 a CoseKey is required, not a Uint8Array')
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
      },
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
      verifyCertificateChain: async (input) => {
        const certificateChain = input.x5chain.map((cert) => X509Certificate.fromRawCertificate(cert).toString('pem'))
        const trustedCertificates = input.trustedCertificates.map((cert) =>
          X509Certificate.fromRawCertificate(cert).toString('pem')
        ) as [string, ...string[]]

        await X509Service.validateCertificateChain(agentContext, {
          certificateChain,
          trustedCertificates,
          verificationDate: input.now ?? now,
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
    },
  } satisfies MdocContext
}
