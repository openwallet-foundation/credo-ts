import type { Signer, Verifier } from '@sd-jwt/core'
import { AgentContext } from '../../agent'
import { CredoError } from '../../error'
import { TypedArrayEncoder } from '../../utils'
import { DidResolverService, DidsApi, getPublicJwkFromVerificationMethod, parseDid } from '../dids'
import { type Jwk, KeyManagementApi, PublicJwk } from '../kms'
import { isKnownJwaSignatureAlgorithm, type KnownJwaSignatureAlgorithm } from '../kms/jwk/jwa'
import { X509Certificate } from '../x509/X509Certificate'
import { SdJwtVcError } from './SdJwtVcError'
import type { SdJwtVcHolderBinding, SdJwtVcIssuer } from './SdJwtVcOptions'

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

export function getSdJwtSigner(
  agentContext: AgentContext,
  key: PublicJwk,
  options?: { jwtHeaderAlg?: string }
): Signer {
  const kms = agentContext.resolve(KeyManagementApi)
  const algorithm = resolveSignatureAlgorithm(key, options?.jwtHeaderAlg)

  return async (input: string) => {
    const result = await kms.sign({
      keyId: key.keyId,
      data: TypedArrayEncoder.fromUtf8String(input),
      algorithm,
    })

    return TypedArrayEncoder.toBase64Url(result.signature)
  }
}

/**
 * Resolve the JWA signature algorithm to use for a JWT operation.
 */
export function resolveSignatureAlgorithm(key: PublicJwk, jwtHeaderAlg?: string): KnownJwaSignatureAlgorithm {
  if (
    jwtHeaderAlg &&
    isKnownJwaSignatureAlgorithm(jwtHeaderAlg) &&
    key.supportedSignatureAlgorithms.includes(jwtHeaderAlg)
  ) {
    return jwtHeaderAlg
  }

  return key.signatureAlgorithm
}

export function getSdJwtVerifier(
  agentContext: AgentContext,
  key: PublicJwk,
  options?: { jwtHeaderAlg?: string }
): Verifier {
  const kms = agentContext.resolve(KeyManagementApi)
  const algorithm = resolveSignatureAlgorithm(key, options?.jwtHeaderAlg)

  return async (message: string, signatureBase64Url: string) => {
    const result = await kms.verify({
      signature: TypedArrayEncoder.fromBase64Url(signatureBase64Url),
      key: {
        publicJwk: key.toJson(),
      },
      data: TypedArrayEncoder.fromUtf8String(message),
      algorithm,
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

export function parseIssuerFromCredential(
  header?: Record<string, unknown>,
  payload?: Record<string, unknown>
): SdJwtVcIssuer {
  if (!payload || !header) throw new SdJwtVcError('SD-JWT is missing payload')
  const iss = payload.iss as string | undefined

  if (header?.x5c) {
    if (!Array.isArray(header.x5c)) {
      throw new SdJwtVcError('Invalid x5c header in credential. Not an array.')
    }
    if (header.x5c.length === 0) {
      throw new SdJwtVcError('Invalid x5c header in credential. Empty array.')
    }
    if (header.x5c.some((x5c) => typeof x5c !== 'string')) {
      throw new SdJwtVcError('Invalid x5c header in credential. Not an array of strings.')
    }

    const certificateChain = header.x5c.map((cert) => X509Certificate.fromEncodedCertificate(cert))

    return {
      method: 'x5c',
      x5c: certificateChain,
      issuer: iss,
    }
  }

  if (iss?.startsWith('did:')) {
    // If `did` is used, we require a relative KID to be present to identify
    // the key used by issuer to sign the sd-jwt-vc
    if (!header.kid) {
      throw new SdJwtVcError('Credential does not contain a kid in the header')
    }

    const issuerKid = header.kid as string

    let didUrl: string
    if (issuerKid.startsWith('#')) {
      didUrl = `${iss}${issuerKid}`
    } else if (issuerKid.startsWith('did:')) {
      const didFromKid = parseDid(issuerKid)
      if (didFromKid.did !== iss) {
        throw new SdJwtVcError(
          `kid in header is an absolute DID URL, but the did (${didFromKid.did}) does not match with the 'iss' did (${iss})`
        )
      }

      didUrl = issuerKid
    } else {
      throw new SdJwtVcError(
        'Invalid issuer kid for did. Only absolute or relative (starting with #) did urls are supported.'
      )
    }

    return {
      method: 'did',
      didUrl,
    }
  }

  throw new SdJwtVcError('Unsupported signing method for SD-JWT VC. Only did and x5c are supported at the moment.')
}
