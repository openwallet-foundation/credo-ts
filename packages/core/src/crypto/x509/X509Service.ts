import * as x509 from '@peculiar/x509'
import { injectable } from 'tsyringe'

import { AgentContext } from '../../agent'
import { Key } from '../Key'
import { CredoWebCrypto } from '../webcrypto'

import { ExtensionInput, X509Certificate } from './X509Certificate'
import { X509Error } from './X509Error'

@injectable()
export class X509Service {
  /**
   *
   * Validate a chain of X.509 certificates according to RFC 5280
   *
   * This function requires a list of base64 encoded certificates and, optionally, a certificate that should be found in the chain.
   * If no certificate is provided, it will just assume the leaf certificate
   *
   * The leaf certificate should be the 0th index and the root the last
   *
   * Note:
   *   - Does not check whether a root or intermediate certificate is trusted
   *
   * Additional validation:
   *   - Make sure atleast a single certificate is in the chain
   */
  public static async validateCertificateChain(
    agentContext: AgentContext,
    {
      certificateChain,
      certificate = certificateChain[0],
      date = new Date(),
    }: {
      certificateChain: Array<string>
      certificate?: string
      date?: Date
    }
  ) {
    const webCrypto = new CredoWebCrypto(agentContext)
    if (certificateChain.length === 0) throw new X509Error('Certificate chain is empty')

    const parsedLeafCertificate = new x509.X509Certificate(certificate)

    const parsedCertificates = certificateChain.map((c) => new x509.X509Certificate(c))

    const certificateChainBuilder = new x509.X509ChainBuilder({ certificates: parsedCertificates })

    const chain = await certificateChainBuilder.build(parsedLeafCertificate, webCrypto)

    // The chain is reversed here as the `x5c` header (the expected input),
    // has the leaf certificate as the first entry, while the `x509` library expects this as the last
    const parsedChain = chain.map((c) => X509Certificate.fromRawCertificate(new Uint8Array(c.rawData))).reverse()

    if (parsedChain.length !== certificateChain.length) {
      throw new X509Error('Could not parse the full chain. Likely due to incorrect ordering')
    }

    // Verify the certificate with the publicKey of the certificate above
    for (let i = 0; i < parsedChain.length; i++) {
      const cert = parsedChain[i]
      const previousCertificate = parsedChain[i - 1]
      const publicKey = previousCertificate ? previousCertificate.publicKey : undefined
      await cert.verify({ publicKey, date }, webCrypto)
    }

    return parsedChain
  }

  /**
   *
   * Parses a base64-encoded X.509 certificate into a {@link X509Certificate}
   *
   */
  public static parseCertificate(
    _agentContext: AgentContext,
    { encodedCertificate }: { encodedCertificate: string }
  ): X509Certificate {
    const certificate = X509Certificate.fromEncodedCertificate(encodedCertificate)

    return certificate
  }

  public static getLeafCertificate(
    _agentContext: AgentContext,
    { certificateChain }: { certificateChain: Array<string> }
  ): X509Certificate {
    if (certificateChain.length === 0) throw new X509Error('Certificate chain is empty')

    const certificate = X509Certificate.fromEncodedCertificate(certificateChain[certificateChain.length - 1])

    return certificate
  }

  public static async createSelfSignedCertificate(
    agentContext: AgentContext,
    options: { key: Key; extensions?: ExtensionInput; notBefore?: Date; notAfter?: Date; name?: string }
  ) {
    const webCrypto = new CredoWebCrypto(agentContext)

    const certificate = await X509Certificate.createSelfSigned(options, webCrypto)

    return certificate
  }
}
