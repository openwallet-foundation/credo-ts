import { p256 } from '@noble/curves/nist.js'
import { hkdf } from '@noble/hashes/hkdf.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { CoseKey, type MdocContext } from '@owf/mdoc'
import { AgentContext } from '../../agent'
import { CredoWebCrypto, Hasher } from '../../crypto'
import { X509Certificate } from '../../modules/x509/X509Certificate'
import { X509Service } from '../../modules/x509/X509Service'
import { getMac0Context } from './mac0Context'
import { getSign1Context } from './sign1Context'

export const getMdocContext = (agentContext: AgentContext, { now }: { now?: Date } = {}): MdocContext => {
  const crypto = new CredoWebCrypto(agentContext)

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
