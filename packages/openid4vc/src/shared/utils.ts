import type { AgentContext, DidPurpose, JwaSignatureAlgorithm, Key } from '@credo-ts/core'
import type { OpenId4VcIssuerX5c, OpenId4VcJwtIssuer } from './models'

import { JwtSigner, JwtSignerX5c } from '@animo-id/oauth2'
import {
  CredoError,
  DidsApi,
  SignatureSuiteRegistry,
  X509Service,
  getDomainFromUrl,
  getJwkClassFromKeyType,
  getJwkFromKey,
  getKeyFromVerificationMethod,
} from '@credo-ts/core'

/**
 * Returns the JWA Signature Algorithms that are supported by the wallet.
 *
 * This is an approximation based on the supported key types of the wallet.
 * This is not 100% correct as a supporting a key type does not mean you support
 * all the algorithms for that key type. However, this needs refactoring of the wallet
 * that is planned for the 0.5.0 release.
 */
export function getSupportedJwaSignatureAlgorithms(agentContext: AgentContext): JwaSignatureAlgorithm[] {
  const supportedKeyTypes = agentContext.wallet.supportedKeyTypes

  // Extract the supported JWS algs based on the key types the wallet support.
  const supportedJwaSignatureAlgorithms = supportedKeyTypes
    // Map the supported key types to the supported JWK class
    .map(getJwkClassFromKeyType)
    // Filter out the undefined values
    .filter((jwkClass): jwkClass is Exclude<typeof jwkClass, undefined> => jwkClass !== undefined)
    // Extract the supported JWA signature algorithms from the JWK class
    .flatMap((jwkClass) => jwkClass.supportedSignatureAlgorithms)

  return supportedJwaSignatureAlgorithms
}

export async function getKeyFromDid(
  agentContext: AgentContext,
  didUrl: string,
  allowedPurposes: DidPurpose[] = ['authentication']
) {
  const didsApi = agentContext.dependencyManager.resolve(DidsApi)
  const didDocument = await didsApi.resolveDidDocument(didUrl)
  const verificationMethod = didDocument.dereferenceKey(didUrl, allowedPurposes)

  return getKeyFromVerificationMethod(verificationMethod)
}

export async function openIdTokenIssuerToJwtIssuer(
  agentContext: AgentContext,
  openId4VcTokenIssuer: Exclude<OpenId4VcJwtIssuer, OpenId4VcIssuerX5c> | (OpenId4VcIssuerX5c & { issuer: string })
): Promise<Exclude<JwtSigner, JwtSignerX5c> | (JwtSignerX5c & { issuer: string })> {
  if (openId4VcTokenIssuer.method === 'did') {
    const key = await getKeyFromDid(agentContext, openId4VcTokenIssuer.didUrl)
    const alg = getJwkClassFromKeyType(key.keyType)?.supportedSignatureAlgorithms[0]
    if (!alg) throw new CredoError(`No supported signature algorithms for key type: ${key.keyType}`)

    return {
      method: openId4VcTokenIssuer.method,
      didUrl: openId4VcTokenIssuer.didUrl,
      alg,
    }
  } else if (openId4VcTokenIssuer.method === 'x5c') {
    const leafCertificate = X509Service.getLeafCertificate(agentContext, {
      certificateChain: openId4VcTokenIssuer.x5c,
    })

    const jwk = getJwkFromKey(leafCertificate.publicKey)
    const alg = jwk.supportedSignatureAlgorithms[0]
    if (!alg) {
      throw new CredoError(`No supported signature algorithms found key type: '${jwk.keyType}'`)
    }

    if (
      !openId4VcTokenIssuer.issuer.startsWith('https://') &&
      !(openId4VcTokenIssuer.issuer.startsWith('http://') && agentContext.config.allowInsecureHttpUrls)
    ) {
      throw new CredoError('The X509 certificate issuer must be a HTTPS URI.')
    }

    if (
      !leafCertificate.sanUriNames.includes(openId4VcTokenIssuer.issuer) &&
      !leafCertificate.sanDnsNames.includes(getDomainFromUrl(openId4VcTokenIssuer.issuer))
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
        `The 'iss' claim in the payload does not match a 'SAN-URI' or 'SAN-DNS' name in the x5c certificate. 'iss' value is '${openId4VcTokenIssuer.issuer}', ${sanUriMessage}, ${sanDnsMessage} (for SAN-DNS only domain has to match)`
      )
    }

    return {
      ...openId4VcTokenIssuer,
      alg,
    }
  } else if (openId4VcTokenIssuer.method === 'jwk') {
    const alg = openId4VcTokenIssuer.jwk.supportedSignatureAlgorithms[0]
    if (!alg) {
      throw new CredoError(`No supported signature algorithms for key type: '${openId4VcTokenIssuer.jwk.keyType}'`)
    }
    return {
      ...openId4VcTokenIssuer,
      publicJwk: openId4VcTokenIssuer.jwk.toJson(),
      alg,
    }
  }

  throw new CredoError(`Unsupported jwt issuer method '${(openId4VcTokenIssuer as OpenId4VcJwtIssuer).method}'`)
}

export function getProofTypeFromKey(agentContext: AgentContext, key: Key) {
  const signatureSuiteRegistry = agentContext.dependencyManager.resolve(SignatureSuiteRegistry)

  const supportedSignatureSuites = signatureSuiteRegistry.getAllByKeyType(key.keyType)
  if (supportedSignatureSuites.length === 0) {
    throw new CredoError(`Couldn't find a supported signature suite for the given key type '${key.keyType}'.`)
  }

  return supportedSignatureSuites[0].proofType
}

export function addSecondsToDate(date: Date, seconds: number) {
  return new Date(date.getTime() + seconds * 1000)
}

export function dateToSeconds(date: Date) {
  return Math.floor(date.getTime() / 1000)
}
