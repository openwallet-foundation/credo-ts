import { CredoError } from '../error'
import { parseDid } from '../modules/dids'
import { PublicJwk } from '../modules/kms'
import { legacyTrustedCertificatesToTrustedIssuers } from '../modules/x509/utils/convertLegacyTrustedCertificates'
import { X509Certificate } from '../modules/x509/X509Certificate'
import { X509ModuleConfig } from '../modules/x509/X509ModuleConfig'
import { X509Service } from '../modules/x509/X509Service'
import type { AgentContext } from './context'
import type {
  GetTrustedIssuersForCredential,
  TrustedIssuer,
  TrustedIssuerDid,
  TrustedIssuersForVerificationContext,
  TrustedIssuersForVerificationResult,
  VerificationSigner,
  VerificationSignerDid,
  VerificationTypeCredential,
} from './TrustedIssuersForVerification'

type TrustedIssuerForSigner<SignerMethod extends VerificationSigner['method']> = Extract<
  TrustedIssuer,
  { method: SignerMethod }
>

// biome-ignore lint/complexity/noStaticOnlyClass: no explanation
export class TrustedIssuerContext {
  /**
   * Resolves the trusted issuers for the signer with the `getTrustedIssuersForVerification` callback, falling back
   * to the trusted certificates of the X509 module for x509 signers.
   */
  public static async getTrustedIssuersForVerification<
    Signer extends VerificationSigner,
    AdditionalVerificationTypes extends { type: string } = never,
  >(
    agentContext: AgentContext,
    context: TrustedIssuersForVerificationContext<Signer, AdditionalVerificationTypes>
  ): Promise<TrustedIssuersForVerificationResult<TrustedIssuerForSigner<Signer['method']>> | undefined> {
    // Call the user-registered callback
    const trustedIssuers = await agentContext.config.getTrustedIssuersForVerification?.(agentContext, context)

    if (!trustedIssuers) {
      if (context.signer.method !== 'x509') return undefined

      // X509 signers fall back to the trusted certificates of the X509 module
      const trustedCertificates = agentContext.dependencyManager.resolve(X509ModuleConfig).trustedCertificates
      if (!trustedCertificates) return undefined

      return {
        trustedIssuers: legacyTrustedCertificatesToTrustedIssuers(trustedCertificates) as TrustedIssuerForSigner<
          Signer['method']
        >[],
      }
    }

    for (const trustedIssuer of trustedIssuers.trustedIssuers) {
      // In the future we could allow a signer method to map to multiple trusted issuer methods
      // but for now we require a 1-to-1 mapping
      if (context.signer.method !== trustedIssuer.method) {
        throw new CredoError(
          `All trusted issuer methods must match the signer method (${context.signer.method}). Found method ${trustedIssuer.method}`
        )
      }
    }

    return {
      trustedIssuers: trustedIssuers.trustedIssuers as TrustedIssuerForSigner<Signer['method']>[],
    }
  }

  public static async ensureTrustedSigner<
    Signer extends VerificationSigner,
    AdditionalVerificationTypes extends { type: string } = never,
  >(
    agentContext: AgentContext,
    context: TrustedIssuersForVerificationContext<Signer, AdditionalVerificationTypes>,
    // The trusted issuers to verify the signer against. If not provided they will be dynamically fetched.
    _trustedIssuers?: TrustedIssuer[]
  ): Promise<{ trustedIssuer: TrustedIssuerForSigner<Signer['method']> }> {
    const signer = context.signer
    const trustedIssuers =
      _trustedIssuers ??
      (await TrustedIssuerContext.getTrustedIssuersForVerification(agentContext, context))?.trustedIssuers

    // Nothing is trusted by default, so verification can't continue if there's no trusted issuers returned.
    if (!trustedIssuers) {
      throw new CredoError(
        `No trusted issuers configured for signer method '${signer.method}'. Signer cannot be verified.`
      )
    }

    if (signer.method === 'x509') {
      const x509Issuers = trustedIssuers.filter((t) => t.method === 'x509')
      const validatedChain = await X509Service.validateCertificateChain(agentContext, {
        // TODO: we should allow x509 cert instance here
        certificateChain: signer.certificateChain.map((certificate) => certificate.toString('base64')),
        trustedCertificates: x509Issuers.flatMap((t) => t.issuance),
      })

      // validateCertificateChain returns the chain, where the first element is
      // always the matched trusted certificate from the list we provided
      const trustAnchor = validatedChain[0]
      const trustedIssuer = x509Issuers.find((t) =>
        t.issuance.some((certificate) => X509Certificate.fromEncodedCertificate(certificate).equal(trustAnchor))
      )

      return { trustedIssuer: trustedIssuer as TrustedIssuerForSigner<Signer['method']> }
    }

    if (signer.method === 'did') {
      const didIssuers = trustedIssuers.filter((t) => t.method === 'did') as TrustedIssuerDid[]
      const signerDid = parseDid(signer.didUrl)

      const trustedIssuer = didIssuers.find((t) => {
        const did = parseDid(t.issuance)
        return signerDid.did === did.did
      })

      if (!trustedIssuer) {
        throw new CredoError(`Signer did ${signerDid.did} is not trusted. Unable to verify signature.`)
      }

      return { trustedIssuer: trustedIssuer as TrustedIssuerForSigner<Signer['method']> }
    }

    if (signer.method === 'jwk') {
      const trustedIssuer = trustedIssuers.find(
        (t) => t.method === 'jwk' && PublicJwk.fromUnknown(t.issuance).equals(signer.publicJwk)
      )

      if (!trustedIssuer) {
        throw new CredoError('Signer jwk is not trusted. Unable to verify signature.')
      }

      return { trustedIssuer: trustedIssuer as TrustedIssuerForSigner<Signer['method']> }
    }

    throw new CredoError('Unknown trusted entity signer method')
  }

  /**
   * Ensures the DID signer of a credential is trusted, where `trustedIssuers` can also resolve the
   * trusted issuers for each credential.
   */
  public static async ensureTrustedCredentialSigner(
    agentContext: AgentContext,
    context: { signer: VerificationSignerDid; verification: VerificationTypeCredential },
    trustedIssuers?: TrustedIssuerDid[] | GetTrustedIssuersForCredential
  ) {
    return TrustedIssuerContext.ensureTrustedSigner(
      agentContext,
      context,
      typeof trustedIssuers === 'function' ? await trustedIssuers(context) : trustedIssuers
    )
  }
}
