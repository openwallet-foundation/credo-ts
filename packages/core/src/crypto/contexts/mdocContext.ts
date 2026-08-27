import { CoseKey, type MdocContext } from '@owf/mdoc'
import { AgentContext } from '../../agent'
import { CredoWebCrypto } from '../../crypto'
import { CredoError } from '../../error'
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
      hdkf: async () => {
        // Only invoked for mdoc device MAC authentication (ISO/IEC 18013-5), which Credo does not
        // implement (device signature authentication only). Guarded because the callback contract
        // takes the raw device private key, which is incompatible with a non-exportable, KMS-held key.
        //
        // TODO: implement via a KMS key-agreement operation (ECDH-ES derive-to-secret or KMS-native
        // EMacKey/HMAC) so the key never leaves the KMS — see `keyDeriveEcdhEs` in the askar backend.
        // No new transport needed: the reader ephemeral key is already in the SessionTranscript; the
        // outstanding work is that KMS primitive plus a device-auth mode option on MdocDeviceResponseOptions.
        throw new CredoError(
          'mdoc device MAC authentication is not supported. Only device signature authentication is currently implemented.'
        )
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
