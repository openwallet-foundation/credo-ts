import type { Signer, Verifier } from '@sd-jwt/types'
import { AgentContext } from '../../agent'
import { CredoError } from '../../error'
import { TypedArrayEncoder } from '../../utils'
import { DidResolverService, DidsApi, getPublicJwkFromVerificationMethod, parseDid } from '../dids'
import { type Jwk, KeyManagementApi, PublicJwk } from '../kms'
import type { SdJwtVcHolderBinding, SdJwtVcIssuer } from './SdJwtVcOptions'
import { SdJwtVcError } from './SdJwtVcError'
import { X509Certificate } from '../x509'
import { getDomainFromUrl } from '../../utils/domain'


export async function resolveSigningPublicJwkFromDidUrl(agentContext: AgentContext, didUrl: string) {
  const dids = agentContext.dependencyManager.resolve(DidsApi)

  const { publicJwk } = await dids.resolveVerificationMethodFromCreatedDidRecord(didUrl)
  return publicJwk
}

export async function resolveDidUrl(agentContext: AgentContext, didUrl: string) {
  const didResolver = agentContext.dependencyManager.resolve(DidResolverService)
  const didDocument = await didResolver.resolveDidDocument(agentContext, didUrl)

  return {
    verificationMethod: didDocument.dereferenceKey(didUrl, ['assertionMethod']),
    didDocument,
  }
}

export async function extractKeyFromHolderBinding(
  agentContext: AgentContext,
  holder: SdJwtVcHolderBinding,
  { forSigning = false, jwkKeyId }: { forSigning?: boolean; jwkKeyId?: string } = {}
) {
  if (holder.method === 'did') {
    const parsedDid = parseDid(holder.didUrl)
    if (!parsedDid.fragment) {
      throw new CredoError(`didUrl '${holder.didUrl}' does not contain a '#'. Unable to derive key from did document`)
    }

    let publicJwk: PublicJwk
    if (forSigning) {
      publicJwk = await resolveSigningPublicJwkFromDidUrl(agentContext, holder.didUrl)
    } else {
      const { verificationMethod } = await resolveDidUrl(agentContext, holder.didUrl)
      publicJwk = getPublicJwkFromVerificationMethod(verificationMethod)
    }

    const supportedSignatureAlgorithms = publicJwk.supportedSignatureAlgorithms
    if (supportedSignatureAlgorithms.length === 0) {
      throw new CredoError(`No supported JWA signature algorithms found for key ${publicJwk.jwkTypeHumanDescription}`)
    }
    const alg = supportedSignatureAlgorithms[0]

    return {
      alg,
      publicJwk,
      cnf: {
        // We need to include the whole didUrl here, otherwise the verifier
        // won't know which did it is associated with
        kid: holder.didUrl,
      },
    }
  }
  if (holder.method === 'jwk') {
    const publicJwk = holder.jwk
    const alg = publicJwk.supportedSignatureAlgorithms[0]

    // FIXME: shouldn't we use `if (forSigning && !publicJwk.keyId)`, or at least use keyId over legacyKeyId
    // It depends on whether we foresee security issues with trusting the `kid` field in the issued credential jwk.
    // If there is no key id configured when signing, we assume this credential was issued before we included key ids
    // and the we use the legacy key id.
    if (forSigning) {
      publicJwk.keyId = jwkKeyId ?? publicJwk.legacyKeyId
    }

    return {
      alg,
      publicJwk,
      cnf: {
        jwk: publicJwk.toJson(),
      },
    }
  }

  throw new CredoError("Unsupported credential holder binding. Only 'did' and 'jwk' are supported at the moment.")
}

/**
 * @todo validate the JWT header (alg)
 */
export function getSdJwtSigner(agentContext: AgentContext, key: PublicJwk): Signer {
  const kms = agentContext.resolve(KeyManagementApi)

  return async (input: string) => {
    const result = await kms.sign({
      keyId: key.keyId,
      data: TypedArrayEncoder.fromString(input),
      algorithm: key.signatureAlgorithm,
    })

    return TypedArrayEncoder.toBase64URL(result.signature)
  }
}

/**
 * @todo validate the JWT header (alg)
 */
export function getSdJwtVerifier(agentContext: AgentContext, key: PublicJwk): Verifier {
  const kms = agentContext.resolve(KeyManagementApi)

  return async (message: string, signatureBase64Url: string) => {
    const result = await kms.verify({
      signature: TypedArrayEncoder.fromBase64(signatureBase64Url),
      key: {
        publicJwk: key.toJson(),
      },
      data: TypedArrayEncoder.fromString(message),
      algorithm: key.signatureAlgorithm,
    })

    return result.verified
  }
}

export interface CnfPayload {
  jwk?: Jwk
  kid?: string
}

export function parseHolderBindingFromCredential(payload?: Record<string, unknown>): SdJwtVcHolderBinding | null {
  if (!payload) {
    throw new CredoError('Unable to extract payload from SD-JWT VC')
  }

  if (!payload.cnf) {
    return null
  }
  const cnf: CnfPayload = payload.cnf

  if (cnf.jwk) {
    return {
      method: 'jwk',
      jwk: PublicJwk.fromUnknown(cnf.jwk),
    }
  }
  if (cnf.kid) {
    if (!cnf.kid.startsWith('did:') || !cnf.kid.includes('#')) {
      throw new CredoError('Invalid holder kid for did. Only absolute KIDs for cnf are supported')
    }
    return {
      method: 'did',
      didUrl: cnf.kid,
    }
  }

  throw new CredoError("Unsupported credential holder binding. Only 'did' and 'jwk' are supported at the moment.")
}

export async function extractKeyFromIssuer(agentContext: AgentContext, issuer: SdJwtVcIssuer, forSigning = false) {
    if (issuer.method === 'did') {
      const parsedDid = parseDid(issuer.didUrl)
      if (!parsedDid.fragment) {
        throw new SdJwtVcError(
          `didUrl '${issuer.didUrl}' does not contain a '#'. Unable to derive key from did document`
        )
      }

      let publicJwk: PublicJwk
      if (forSigning) {
        publicJwk = await resolveSigningPublicJwkFromDidUrl(agentContext, issuer.didUrl)
      } else {
        const { verificationMethod } = await resolveDidUrl(agentContext, issuer.didUrl)
        publicJwk = getPublicJwkFromVerificationMethod(verificationMethod)
      }

      const supportedSignatureAlgorithms = publicJwk.supportedSignatureAlgorithms
      if (supportedSignatureAlgorithms.length === 0) {
        throw new SdJwtVcError(
          `No supported JWA signature algorithms found for key ${publicJwk.jwkTypeHumanDescription}`
        )
      }
      const alg = supportedSignatureAlgorithms[0]

      return {
        alg,
        publicJwk,
        iss: parsedDid.did,
        kid: `#${parsedDid.fragment}`,
      }
    }

    if (issuer.method === 'x5c') {
      const leafCertificate = issuer.x5c[0]
      if (!leafCertificate) {
        throw new SdJwtVcError("Empty 'x5c' array provided")
      }

      if (forSigning && !leafCertificate.publicJwk.hasKeyId) {
        throw new SdJwtVcError("Expected leaf certificate in 'x5c' array to have a key id configured.")
      }

      const publicJwk = leafCertificate.publicJwk
      const supportedSignatureAlgorithms = publicJwk.supportedSignatureAlgorithms
      if (supportedSignatureAlgorithms.length === 0) {
        throw new SdJwtVcError(
          `No supported JWA signature algorithms found for key ${publicJwk.jwkTypeHumanDescription}`
        )
      }
      const alg = supportedSignatureAlgorithms[0]

      assertValidX5cJwtIssuer(agentContext, issuer.issuer, leafCertificate)

      return {
        publicJwk,
        iss: issuer.issuer,
        x5c: issuer.x5c,
        alg,
      }
    }

    throw new SdJwtVcError("Unsupported credential issuer. Only 'did' and 'x5c' is supported at the moment.")
  }

function  assertValidX5cJwtIssuer(
      agentContext: AgentContext,
      iss: string | undefined,
      leafCertificate: X509Certificate
    ) {
      // No 'iss' is allowed for X509
      if (!iss) return
  
      // If iss is present it MUST be an HTTPS url
      if (!iss.startsWith('https://') && !(iss.startsWith('http://') && agentContext.config.allowInsecureHttpUrls)) {
        throw new SdJwtVcError('The X509 certificate issuer must be a HTTPS URI.')
      }
  
      if (!leafCertificate.sanUriNames?.includes(iss) && !leafCertificate.sanDnsNames?.includes(getDomainFromUrl(iss))) {
        throw new SdJwtVcError(
          `The 'iss' claim in the payload does not match a 'SAN-URI' name and the domain extracted from the HTTPS URI does not match a 'SAN-DNS' name in the x5c certificate. Either remove the 'iss' claim or make it match with at least one SAN-URI or DNS-URI entry`
        )
      }
    }