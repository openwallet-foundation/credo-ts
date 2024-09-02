import type { com, Nullable } from '@sphereon/kmp-mdl-mdoc'

import { type AgentContext } from '../../agent'
import { X509ModuleConfig } from '../x509'
import { X509Certificate } from '../x509/X509Certificate'
import { X509Service } from '../x509/X509Service'

import { MdocError } from './MdocError'

type IX509CallbackServiceJS = com.sphereon.crypto.IX509ServiceJS

type IKey = com.sphereon.crypto.IKey

type IX509VerificationResult<KeyType extends IKey> = com.sphereon.crypto.IX509VerificationResult<KeyType>

/**
 * This class can be used for X509 validations.
 * Either have an instance per trustedCerts and verification invocation or use a single instance and provide the trusted certs in the method argument
 *
 * The class is also registered with the low-level mDL/mdoc Kotlin Multiplatform library
 * Next to the specific function for the library it exports a more powerful version of the same verification method as well
 */
export class MdocX509CallbackService implements IX509CallbackServiceJS {
  private trustedCertificates: [string, ...string[]]
  public constructor(private agentContext: AgentContext, trustedCertificates?: [string, ...string[]]) {
    const _trustedCertificates =
      trustedCertificates ?? agentContext.dependencyManager.resolve(X509ModuleConfig).trustedCertificates

    if (!_trustedCertificates) {
      throw new MdocError('Missing trusted certificates for Mdoc validation.')
    }
    this.trustedCertificates = _trustedCertificates
  }

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

      return {
        name: 'x509-verification',
        message: 'x509-chain successfully validated',
        critical: false,
        error: false,
      } satisfies IX509VerificationResult<IKey>
    } catch (error) {
      return {
        name: 'x509-verification',
        message:
          error instanceof Error
            ? `Modoc x509 certificate chain validation failed. ${error.message}`
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
