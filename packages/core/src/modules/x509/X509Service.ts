import type {
  X509CreateCertificateOptions,
  X509GetLeafCertificateOptions,
  X509ParseCertificateOptions,
  X509ValidateCertificateChainOptions,
} from './X509ServiceOptions'

import * as x509 from '@peculiar/x509'
import { injectable } from 'tsyringe'

import { AgentContext } from '../../agent'
import { CredoWebCrypto } from '../../crypto/webcrypto'

import { X509Certificate } from './X509Certificate'
import { X509Error } from './X509Error'

@injectable()
// biome-ignore lint/complexity/noStaticOnlyClass: <explanation>
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
   * Additional validation:
   *   - Make sure atleast a single certificate is in the chain
   *   - Check whether a certificate in the chain matches with a trusted certificate
   */
  public static async validateCertificateChain(
    agentContext: AgentContext,
    {
      certificateChain,
      certificate = certificateChain[0],
      verificationDate = new Date(),
      trustedCertificates,
    }: X509ValidateCertificateChainOptions
  ) {
    const webCrypto = new CredoWebCrypto(agentContext)
    if (certificateChain.length === 0) throw new X509Error('Certificate chain is empty')

    const parsedLeafCertificate = new x509.X509Certificate(certificate)

    const certificatesToBuildChain = [...certificateChain, ...(trustedCertificates ?? [])].map(
      (c) => new x509.X509Certificate(c)
    )

    const certificateChainBuilder = new x509.X509ChainBuilder({
      certificates: certificatesToBuildChain,
    })

    const chain = await certificateChainBuilder.build(parsedLeafCertificate, webCrypto)

    // The chain is reversed here as the `x5c` header (the expected input),
    // has the leaf certificate as the first entry, while the `x509` library expects this as the last
    let parsedChain = chain.map((c) => X509Certificate.fromRawCertificate(new Uint8Array(c.rawData))).reverse()

    // We allow longer parsed chain, in case the root cert was not part of the chain, but in the
    // list of trusted certificates
    if (parsedChain.length < certificateChain.length) {
      throw new X509Error('Could not parse the full chain. Likely due to incorrect ordering')
    }

    if (trustedCertificates) {
      const parsedTrustedCertificates = trustedCertificates.map((trustedCertificate) =>
        X509Certificate.fromEncodedCertificate(trustedCertificate)
      )

      const trustedCertificateIndex = parsedChain.findIndex((cert) =>
        parsedTrustedCertificates.some((tCert) => cert.equal(tCert))
      )

      if (trustedCertificateIndex === -1) {
        throw new X509Error('No trusted certificate was found while validating the X.509 chain')
      }

      // Pop everything off above the index of the trusted as it is not relevant for validation
      parsedChain = parsedChain.slice(0, trustedCertificateIndex)
    }

    // Verify the certificate with the publicKey of the certificate above
    for (let i = 0; i < parsedChain.length; i++) {
      const cert = parsedChain[i]
      const previousCertificate = parsedChain[i - 1]
      const publicKey = previousCertificate ? previousCertificate.publicKey : undefined
      await cert.verify({ publicKey, verificationDate }, webCrypto)
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
    { encodedCertificate }: X509ParseCertificateOptions
  ): X509Certificate {
    const certificate = X509Certificate.fromEncodedCertificate(encodedCertificate)

    return certificate
  }

  public static getLeafCertificate(
    _agentContext: AgentContext,
    { certificateChain }: X509GetLeafCertificateOptions
  ): X509Certificate {
    if (certificateChain.length === 0) throw new X509Error('Certificate chain is empty')

    const certificate = X509Certificate.fromEncodedCertificate(certificateChain[0])

    return certificate
  }

  public static async createCertificate(agentContext: AgentContext, options: X509CreateCertificateOptions) {
    const webCrypto = new CredoWebCrypto(agentContext)

    const certificate = await X509Certificate.create(options, webCrypto)

    return certificate
  }
}
