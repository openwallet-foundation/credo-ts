import { CredoError } from '../error'
import { parseDid } from '../modules/dids'
import { X509Certificate } from '../modules/x509/X509Certificate'
import { X509Service } from '../modules/x509/X509Service'
import type { AgentContext } from './context'
import type {
  TrustedIssuer,
  TrustedIssuerDid,
  TrustedIssuersForVerificationContext,
  TrustedIssuersForVerificationResult,
  VerificationSigner,
} from './TrustedIssuersForVerification'

type TrustedIssuerForSigner<SignerMethod extends VerificationSigner['method']> = Extract<
  TrustedIssuer,
  { method: SignerMethod }
>

// biome-ignore lint/complexity/noStaticOnlyClass: no explanation
export class TrustedIssuerContext {
  public static async getTrustedIssuersForVerification<
    Signer extends VerificationSigner,
    AdditionalVerificationTypes extends { type: string } = never,
  >(
    agentContext: AgentContext,
    context: TrustedIssuersForVerificationContext<Signer, AdditionalVerificationTypes>
  ): Promise<TrustedIssuersForVerificationResult<TrustedIssuerForSigner<Signer['method']>> | undefined> {
    // Call the user-registered callback
    const trustedIssuers = await agentContext.config.getTrustedIssuersForVerification?.(agentContext, context)

    // If there's no result, we return undefined (generally means we allow anything, but in case of mdoc nothing)
    if (!trustedIssuers) return undefined

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
  ): Promise<{ trustedIssuer: TrustedIssuerForSigner<Signer['method']> | undefined }> {
    const signer = context.signer
    const trustedIssuers =
      _trustedIssuers ??
      (await TrustedIssuerContext.getTrustedIssuersForVerification(agentContext, context))?.trustedIssuers

    if (signer.method === 'x509') {
      // For X509 we do not allow verification to continue if there's no trusted issuers returned.
      if (!trustedIssuers) {
        throw new CredoError(
          'No trusted certificates configured for X509 certificate chain validation. Signer cannot be verified.'
        )
      }

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
      // For DIDs we do allow verification to continue if there's no trusted issuers returned. To mimic original behavior.
      // This can easily be disabled by returning an empty array
      if (!trustedIssuers) return { trustedIssuer: undefined }

      const didIssuers = trustedIssuers?.filter((t) => t.method === 'did') as TrustedIssuerDid[]
      const signerDid = parseDid(signer.didUrl)

      const trustedIssuer = didIssuers.find((t) => {
        const did = parseDid(t.did)
        return signerDid.did === did.did
      })

      if (!trustedIssuer) {
        throw new CredoError(`Signer did ${signerDid.did} is not trusted. Unable to verify signature.`)
      }

      return { trustedIssuer: trustedIssuer as TrustedIssuerForSigner<Signer['method']> }
    }

    throw new CredoError('Unknown trusted entity signer method')
  }
}
