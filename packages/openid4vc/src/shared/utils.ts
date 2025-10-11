import { AgentContext, ClaimFormat, type DcqlQuery, type DidPurpose, Kms } from '@credo-ts/core'
import type { Jwk, JwtSigner, JwtSignerX5c } from '@openid4vc/oauth2'
import type { OpenId4VcJwtIssuer } from './models'

import {
  CredoError,
  DidsApi,
  SignatureSuiteRegistry,
  getDomainFromUrl,
  getPublicJwkFromVerificationMethod,
} from '@credo-ts/core'

/**
 * Returns the JWA Signature Algorithms that are supported by the wallet.
 */
export function getSupportedJwaSignatureAlgorithms(agentContext: AgentContext): Kms.KnownJwaSignatureAlgorithm[] {
  const kms = agentContext.resolve(Kms.KeyManagementApi)

  // If we can sign with an algorithm we assume it's supported (also for verification)
  const supportedJwaSignatureAlgorithms = Object.values(Kms.KnownJwaSignatureAlgorithms).filter(
    (algorithm) => kms.supportedBackendsForOperation({ operation: 'sign', algorithm }).length > 0
  )

  return supportedJwaSignatureAlgorithms
}

export async function getPublicJwkFromDid(
  agentContext: AgentContext,
  didUrl: string,
  allowedPurposes: DidPurpose[] = ['authentication']
) {
  const didsApi = agentContext.dependencyManager.resolve(DidsApi)
  const didDocument = await didsApi.resolveDidDocument(didUrl)
  const verificationMethod = didDocument.dereferenceKey(didUrl, allowedPurposes)

  return getPublicJwkFromVerificationMethod(verificationMethod)
}

export async function requestSignerToJwtIssuer(
  agentContext: AgentContext,
  requestSigner: OpenId4VcJwtIssuer
): Promise<Exclude<JwtSigner, JwtSignerX5c> | (JwtSignerX5c & { issuer: string })> {
  if (requestSigner.method === 'did') {
    const dids = agentContext.resolve(DidsApi)
    const { publicJwk } = await dids.resolveVerificationMethodFromCreatedDidRecord(requestSigner.didUrl)

    return {
      method: requestSigner.method,
      didUrl: requestSigner.didUrl,
      alg: publicJwk.signatureAlgorithm,
      kid: publicJwk.keyId,
    }
  }
  if (requestSigner.method === 'x5c') {
    const leafCertificate = requestSigner.x5c[0]
    if (!leafCertificate) {
      throw new CredoError('Unable to extract leaf certificate, x5c certificate chain is empty')
    }

    if (
      !requestSigner.issuer.startsWith('https://') &&
      !(requestSigner.issuer.startsWith('http://') && agentContext.config.allowInsecureHttpUrls)
    ) {
      throw new CredoError('The X509 certificate issuer must be a HTTPS URI.')
    }

    if (
      !leafCertificate.sanUriNames.includes(requestSigner.issuer) &&
      !leafCertificate.sanDnsNames.includes(getDomainFromUrl(requestSigner.issuer))
    ) {
      const sanUriMessage =
        leafCertificate.sanUriNames.length > 0
          ? `SAN-URI names are ${leafCertificate.sanUriNames.join(', ')}`
          : 'there are no SAN-URI names'
      const sanDnsMessage =
        leafCertificate.sanDnsNames.length > 0
          ? `SAN-DNS names are ${leafCertificate.sanDnsNames.join(', ')}`
          : 'there are no SAN-DNS names'
      throw new Error(
        `The 'iss' claim in the payload does not match a 'SAN-URI' or 'SAN-DNS' name in the x5c certificate. 'iss' value is '${requestSigner.issuer}', ${sanUriMessage}, ${sanDnsMessage} (for SAN-DNS only domain has to match)`
      )
    }

    return {
      ...requestSigner,
      x5c: requestSigner.x5c.map((certificate) => certificate.toString('base64')),
      alg: leafCertificate.publicJwk.signatureAlgorithm,
      kid: leafCertificate.publicJwk.keyId,
    }
  }
  if (requestSigner.method === 'jwk') {
    return {
      ...requestSigner,
      publicJwk: requestSigner.jwk.toJson() as Jwk,
      alg: requestSigner.jwk.signatureAlgorithm,
    }
  }

  throw new CredoError(`Unsupported jwt issuer method '${(requestSigner as OpenId4VcJwtIssuer).method}'`)
}

export function getProofTypeFromPublicJwk(agentContext: AgentContext, key: Kms.PublicJwk) {
  const signatureSuiteRegistry = agentContext.dependencyManager.resolve(SignatureSuiteRegistry)

  const supportedSignatureSuites = signatureSuiteRegistry.getAllByPublicJwkType(key)
  if (supportedSignatureSuites.length === 0) {
    throw new CredoError(`Couldn't find a supported signature suite for the given key ${key.jwkTypehumanDescription}.`)
  }

  return supportedSignatureSuites[0].proofType
}

export function parseIfJson<T>(input: T): T | Record<string, unknown> {
  if (typeof input !== 'string') {
    return input
  }

  try {
    // Try to parse the string as JSON
    return JSON.parse(input)
  } catch (_error) {
    /* empty */
  }

  return input
}

export function dcqlCredentialQueryToPresentationFormat(credential: DcqlQuery['credentials'][number]) {
  switch (credential.format) {
    case 'dc+sd-jwt':
      return ClaimFormat.SdJwtDc
    case 'vc+sd-jwt':
      if (credential.meta && 'type_values' in credential.meta) {
        return ClaimFormat.SdJwtW3cVp
      }

      return ClaimFormat.SdJwtDc
    case 'jwt_vc_json':
      return ClaimFormat.JwtVp
    case 'ldp_vc':
      return ClaimFormat.LdpVp
    case 'mso_mdoc':
      return ClaimFormat.MsoMdoc
  }
}
