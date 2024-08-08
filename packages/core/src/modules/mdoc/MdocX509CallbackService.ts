import type { AgentContext } from '../..'
import type { com, Nullable } from '@sphereon/kmp-mdl-mdoc'

import { X509Certificate } from '../x509/X509Certificate'
import { X509Service } from '../x509/X509Service'

type IX509CallbackServiceJS = com.sphereon.crypto.IX509ServiceJS

type IKey = com.sphereon.cbor.cose.IKey
type IX509VerificationResult<KeyType extends IKey> = com.sphereon.crypto.IX509VerificationResult<KeyType>

/**
 * This class can be used for X509 validations.
 * Either have an instance per trustedCerts and verification invocation or use a single instance and provide the trusted certs in the method argument
 *
 * The class is also registered with the low-level mDL/mdoc Kotlin Multiplatform library
 * Next to the specific function for the library it exports a more powerful version of the same verification method as well
 */
export class MdocX509CallbackService implements IX509CallbackServiceJS {
  public constructor(private agentContext: AgentContext, private trustedCertificates: [string, ...string[]]) {}

  /**
   * This method is the implementation used within the mDL/Mdoc library
   */
  public async verifyCertificateChainJS<KeyType extends IKey>(
    chainDER: Nullable<Int8Array[]>
  ): Promise<IX509VerificationResult<KeyType>> {
    if (!chainDER) {
      return {
        name: 'x509-verification invalid parameters',
        message: 'Missing ChainDER parameter when verifying the Certificate chain.',
        critical: true,
        error: true,
      } satisfies IX509VerificationResult<IKey>
    }

    try {
      const certificateChain = chainDER.map((value) =>
        X509Certificate.fromRawCertificate(new Uint8Array(value)).toString('base64url')
      )

      await X509Service.validateCertificateChain(this.agentContext, { certificateChain })
      const leafCertificate = X509Service.getLeafCertificate(this.agentContext, { certificateChain })

      return {
        publicKey: leafCertificate.publicKey as unknown as undefined, // TODO:
        publicKeyAlgorithm: undefined,
        publicKeyParams: undefined,
        name: 'x509-verification success',
        message: 'x509-chain successfully validated',
        critical: false,
        error: false,
      } satisfies IX509VerificationResult<IKey>
    } catch (error) {
      return {
        name: 'x509-verification failed',
        message:
          error instanceof Error
            ? error.message
            : 'An unknown error occurred during x509 certificate chain validation.',
        critical: true,
        error: true,
      } satisfies IX509VerificationResult<IKey>
    }
  }

  public getTrustedCerts = () => {
    return this.trustedCertificates
  }
}
