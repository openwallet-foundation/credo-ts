import type { OpenId4VcIssuerX5c, OpenId4VcJwtIssuer } from './models'
import type { AgentContext, JwaSignatureAlgorithm, JwkJson, Key } from '@credo-ts/core'
import type { JwtIssuerWithContext as VpJwtIssuerWithContext, VerifyJwtCallback } from '@sphereon/did-auth-siop'
import type { DPoPJwtIssuerWithContext, CreateJwtCallback, JwtIssuer } from '@sphereon/oid4vc-common'
import type { CredentialOfferPayloadV1_0_11, CredentialOfferPayloadV1_0_13 } from '@sphereon/oid4vci-common'

import {
  CredoError,
  DidsApi,
  JwsService,
  JwtPayload,
  SignatureSuiteRegistry,
  X509Service,
  getDomainFromUrl,
  getJwkClassFromKeyType,
  getJwkFromJson,
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

async function getKeyFromDid(agentContext: AgentContext, didUrl: string) {
  const didsApi = agentContext.dependencyManager.resolve(DidsApi)
  const didDocument = await didsApi.resolveDidDocument(didUrl)
  const verificationMethod = didDocument.dereferenceKey(didUrl, ['authentication'])

  return getKeyFromVerificationMethod(verificationMethod)
}

export function getVerifyJwtCallback(agentContext: AgentContext): VerifyJwtCallback {
  return async (jwtVerifier, jwt) => {
    const jwsService = agentContext.dependencyManager.resolve(JwsService)
    if (jwtVerifier.method === 'did') {
      const key = await getKeyFromDid(agentContext, jwtVerifier.didUrl)
      const jwk = getJwkFromKey(key)

      const res = await jwsService.verifyJws(agentContext, { jws: jwt.raw, jwkResolver: () => jwk })
      return res.isValid
    } else if (jwtVerifier.method === 'x5c' || jwtVerifier.method === 'jwk') {
      const res = await jwsService.verifyJws(agentContext, { jws: jwt.raw })
      return res.isValid
    } else {
      throw new Error(`Unsupported jwt verifier method: '${jwtVerifier.method}'`)
    }
  }
}

export function getCreateJwtCallback(
  agentContext: AgentContext
): CreateJwtCallback<DPoPJwtIssuerWithContext | VpJwtIssuerWithContext> {
  return async (jwtIssuer, jwt) => {
    const jwsService = agentContext.dependencyManager.resolve(JwsService)

    if (jwtIssuer.method === 'did') {
      const key = await getKeyFromDid(agentContext, jwtIssuer.didUrl)
      const jws = await jwsService.createJwsCompact(agentContext, {
        protectedHeaderOptions: { ...jwt.header, alg: jwtIssuer.alg, jwk: undefined },
        payload: JwtPayload.fromJson(jwt.payload),
        key,
      })

      return jws
    } else if (jwtIssuer.method === 'jwk') {
      if (!jwtIssuer.jwk.kty) {
        throw new CredoError('Missing required key type (kty) in the jwk.')
      }
      const jwk = getJwkFromJson(jwtIssuer.jwk as JwkJson)
      const key = jwk.key
      const jws = await jwsService.createJwsCompact(agentContext, {
        protectedHeaderOptions: { ...jwt.header, jwk, alg: jwtIssuer.alg },
        payload: JwtPayload.fromJson(jwt.payload),
        key,
      })

      return jws
    } else if (jwtIssuer.method === 'x5c') {
      const leafCertificate = X509Service.getLeafCertificate(agentContext, { certificateChain: jwtIssuer.x5c })

      const jws = await jwsService.createJwsCompact(agentContext, {
        protectedHeaderOptions: { ...jwt.header, alg: jwtIssuer.alg, jwk: undefined },
        payload: JwtPayload.fromJson(jwt.payload),
        key: leafCertificate.publicKey,
      })

      return jws
    }

    throw new Error(`Unsupported jwt issuer method '${jwtIssuer.method}'`)
  }
}

export async function openIdTokenIssuerToJwtIssuer(
  agentContext: AgentContext,
  openId4VcTokenIssuer: Exclude<OpenId4VcJwtIssuer, OpenId4VcIssuerX5c> | (OpenId4VcIssuerX5c & { issuer: string })
): Promise<JwtIssuer> {
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

    if (!openId4VcTokenIssuer.issuer.startsWith('https://')) {
      throw new CredoError('The X509 certificate issuer must be a HTTPS URI.')
    }

    if (
      !leafCertificate.sanUriNames?.includes(openId4VcTokenIssuer.issuer) &&
      !leafCertificate.sanDnsNames?.includes(getDomainFromUrl(openId4VcTokenIssuer.issuer))
    ) {
      throw new Error(
        `The 'iss' claim in the payload does not match a 'SAN-URI' or 'SAN-DNS' name in the x5c certificate.`
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
      jwk: openId4VcTokenIssuer.jwk.toJson(),
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

export const isCredentialOfferV1Draft13 = (
  credentialOffer: CredentialOfferPayloadV1_0_11 | CredentialOfferPayloadV1_0_13
): credentialOffer is CredentialOfferPayloadV1_0_13 => {
  return 'credential_configuration_ids' in credentialOffer
}
