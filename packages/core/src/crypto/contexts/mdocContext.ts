import { p256 } from '@noble/curves/nist.js'
import { hkdf } from '@noble/hashes/hkdf.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { CoseKey, type HpkeSuiteId, type MdocContext } from '@owf/mdoc'
import { AgentContext } from '../../agent'
import { CredoWebCrypto, Hasher } from '../../crypto'
import { CredoError } from '../../error'
import { KeyManagementApi, type KmsJwkPublicEcdh, type KnownJwaHpkeAlgorithm, PublicJwk } from '../../modules/kms'
import { X509Certificate } from '../../modules/x509/X509Certificate'
import { X509Service } from '../../modules/x509/X509Service'
import { getMac0Context } from './mac0Context'
import { getSign1Context } from './sign1Context'

/**
 * HPKE suites the mdoc library can request, mapped to the JOSE-HPKE style algorithm identifiers the
 * KMS uses. ISO 18013-7 Annex C only uses the first entry.
 */
const hpkeSuiteToJwaAlgorithm = {
  'dhkem-p256-hkdf-sha256/hkdf-sha256/aes-128-gcm': 'HPKE-0',
  'dhkem-p256-hkdf-sha256/hkdf-sha256/aes-256-gcm': 'HPKE-7',
  'dhkem-x25519-hkdf-sha256/hkdf-sha256/aes-128-gcm': 'HPKE-3',
} as const satisfies Record<HpkeSuiteId, KnownJwaHpkeAlgorithm>

function jwaAlgorithmForHpkeSuite(suite: HpkeSuiteId) {
  const algorithm = hpkeSuiteToJwaAlgorithm[suite]
  if (!algorithm) throw new CredoError(`Unsupported HPKE suite '${suite}'`)

  return algorithm
}

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
            // NOTE:  extra Uint8Array wrapping is needed here, somehow if we use `bytes.buffer` directly
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
      hpke: {
        suites: Object.keys(hpkeSuiteToJwaAlgorithm) as HpkeSuiteId[],
        seal: async (input) => {
          const { encrypted, encapsulatedKey } = await kms.encrypt({
            key: {
              keyAgreement: {
                algorithm: jwaAlgorithmForHpkeSuite(input.suite),
                externalPublicJwk: PublicJwk.fromUnknown(input.recipientPublicKey.jwk).toJson() as KmsJwkPublicEcdh,
                info: input.info,
              },
            },
            encryption: { algorithm: 'HPKE', aad: input.aad },
            data: input.plaintext,
          })

          if (!encapsulatedKey) {
            throw new CredoError('Key management service did not return an encapsulated key for HPKE seal')
          }

          return { enc: encapsulatedKey, ciphertext: encrypted }
        },
        open: async (input) => {
          const { keyId } = input.recipientKey
          if (!keyId) {
            throw new CredoError('Missing required keyId on the recipient key for HPKE open')
          }

          const { data } = await kms.decrypt({
            key: {
              keyAgreement: {
                algorithm: jwaAlgorithmForHpkeSuite(input.suite),
                keyId,
                encapsulatedKey: input.enc,
                info: input.info,
              },
            },
            decryption: { algorithm: 'HPKE', aad: input.aad },
            encrypted: input.ciphertext,
          })

          return data
        },
      },
    },

    cose: {
      mac0: getMac0Context(agentContext),
      sign1: getSign1Context(agentContext),
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
      verifyCertificateChain: async (input) => {
        const certificateChain = input.x5chain.map((cert) => X509Certificate.fromRawCertificate(cert).toString('pem'))
        const trustedCertificates = input.trustedCertificates.map((cert) =>
          X509Certificate.fromRawCertificate(cert).toString('pem')
        ) as [string, ...string[]]

        const validatedChain = await X509Service.validateCertificateChain(agentContext, {
          certificateChain,
          trustedCertificates,
          verificationDate: input.now ?? now,
        })

        // X509Service.validateCertificateChain returns the chain root-first. The mdoc context contract
        // requires the chain to be leaf-first with the trust anchor (root) as the last entry, so reverse here.
        return {
          chain: validatedChain.map((cert) => cert.rawCertificate).reverse(),
        }
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
