import type { Signer, Verifier } from '@sd-jwt/core'
import { AgentContext } from '../../agent'
import type { HashName } from '../../crypto'
import { CredoError } from '../../error'
import { TypedArrayEncoder } from '../../utils'
import {
  type DidDocument,
  type DidPurpose,
  type DidResolutionOptions,
  DidResolverService,
  DidsApi,
  getPublicJwkFromVerificationMethod,
  parseDid,
} from '../dids'
import { isKnownJwaSignatureAlgorithm, type Jwk, KeyManagementApi, PublicJwk } from '../kms'
import { X509Certificate } from '../x509/X509Certificate'
import { SdJwtVcError } from './SdJwtVcError'
import type { SdJwtVcHolderBinding, SdJwtVcIssuer } from './SdJwtVcOptions'

export async function resolveSigningPublicJwkFromDidUrl(agentContext: AgentContext, didUrl: string) {
  const dids = agentContext.dependencyManager.resolve(DidsApi)

  const { publicJwk } = await dids.resolveVerificationMethodFromCreatedDidRecord(didUrl)
  return publicJwk
}

/**
 * Whether the did is a `did:x509`. Resolving such a did is only meaningful (and secure) when it is
 * resolved with the certificate chain as evidence, see `getDidX509ResolutionOptions`.
 */
export function isDidX509(did: string) {
  return did.startsWith('did:x509:')
}

/**
 * Resolution options to resolve a `did:x509` with its certificate chain, as described in the did:x509 specification:
 * the `x509chain` resolution option is a comma separated list of base64url encoded DER certificates,
 * leaf first and the trust anchor last.
 *
 * Caching and locally created did records are disabled, as the outcome depends on the chain that is
 * provided, not only on the did. Serving a did document from either would skip validation of the chain
 * against the did.
 */
export function getDidX509ResolutionOptions(x5c: X509Certificate[]): DidResolutionOptions {
  return {
    x509chain: x5c.map((certificate) => TypedArrayEncoder.toBase64Url(certificate.rawCertificate)).join(','),
    useCache: false,
    persistInCache: false,
    useLocalCreatedDidRecord: false,
  }
}

export async function resolveDidUrl(
  agentContext: AgentContext,
  didUrl: string,
  purposes: DidPurpose[] = ['assertionMethod'],
  resolutionOptions?: DidResolutionOptions
) {
  const didResolver = agentContext.dependencyManager.resolve(DidResolverService)

  let didDocument: DidDocument
  if (resolutionOptions) {
    const { didDocument: resolvedDidDocument, didResolutionMetadata } = await didResolver.resolve(
      agentContext,
      didUrl,
      resolutionOptions
    )
    if (!resolvedDidDocument) {
      throw new CredoError(
        `Unable to resolve did document for did '${didUrl}': ${didResolutionMetadata.error} ${didResolutionMetadata.message}`
      )
    }
    didDocument = resolvedDidDocument
  } else {
    didDocument = await didResolver.resolveDidDocument(agentContext, didUrl)
  }

  return {
    verificationMethod: didDocument.dereferenceKey(didUrl, purposes),
    didDocument,
  }
}

export async function extractKeyFromHolderBinding(
  agentContext: AgentContext,
  holder: SdJwtVcHolderBinding,
  {
    forSigning = false,
    jwkKeyId,
    didPurposes,
  }: { forSigning?: boolean; jwkKeyId?: string; didPurposes?: DidPurpose[] } = {}
) {
  if (holder.method === 'did') {
    const parsedDid = parseDid(holder.didUrl)
    if (!parsedDid.fragment) {
      throw new CredoError(`didUrl '${holder.didUrl}' does not contain a '#'. Unable to derive key from did document`)
    }

    let publicJwk: PublicJwk
    let did: string | undefined
    if (forSigning) {
      publicJwk = await resolveSigningPublicJwkFromDidUrl(agentContext, holder.didUrl)
    } else {
      const { verificationMethod, didDocument } = await resolveDidUrl(agentContext, holder.didUrl, didPurposes)
      publicJwk = getPublicJwkFromVerificationMethod(verificationMethod)
      did = didDocument.id
    }

    const supportedSignatureAlgorithms = publicJwk.supportedSignatureAlgorithms
    if (supportedSignatureAlgorithms.length === 0) {
      throw new CredoError(`No supported JWA signature algorithms found for key ${publicJwk.jwkTypeHumanDescription}`)
    }
    const alg = supportedSignatureAlgorithms[0]

    return {
      alg,
      publicJwk,
      did,
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

/**
 * Set the `alg` from a JWT header on the public jwk, so signing and verification use the
 * algorithm of the JWT rather than the first supported signature algorithm of the key.
 *
 * Throws an error if the alg is not a known JWA signature algorithm, or if the alg is not
 * supported by the jwk.
 */
export function setJwkAlgFromJwtHeader(publicJwk: PublicJwk, jwtHeaderAlg: unknown) {
  if (typeof jwtHeaderAlg !== 'string' || !isKnownJwaSignatureAlgorithm(jwtHeaderAlg)) {
    throw new CredoError(`Expected JWT header 'alg' to be a known JWA signature algorithm, found '${jwtHeaderAlg}'`)
  }

  publicJwk.alg = jwtHeaderAlg
}

/**
 * Hashing algorithms that can be used for the disclosure digests of an SD-JWT, and are placed
 * in the `_sd_alg` claim.
 *
 * `sha-1` is omitted, as SD-JWT requires a hash algorithm that is considered secure at the
 * time of issuance.
 *
 * @see https://www.ietf.org/archive/id/draft-ietf-oauth-selective-disclosure-jwt-22.html#name-hash-function-claim
 */
export const sdJwtHashingAlgorithms: Array<Exclude<HashName, 'sha-1'>> = ['sha-256', 'sha-384', 'sha-512']

/**
 * Get the hashing algorithm to use for the disclosure digests of an SD-JWT, defaulting to `sha-256`.
 *
 * The sign options already exclude insecure hashing algorithms on a type level, but this is
 * enforced at runtime as well, as the value can originate from JavaScript callers or dynamic input.
 */
export function getSdJwtHashingAlgorithm(hashingAlgorithm?: HashName): Exclude<HashName, 'sha-1'> {
  const hashAlg = hashingAlgorithm ?? 'sha-256'

  if (!sdJwtHashingAlgorithms.includes(hashAlg as Exclude<HashName, 'sha-1'>)) {
    throw new CredoError(
      `Unsupported hashing algorithm '${hashAlg}' for the disclosure digests of an SD-JWT. Supported hashing algorithms are ${sdJwtHashingAlgorithms.join(', ')}`
    )
  }

  return hashAlg as Exclude<HashName, 'sha-1'>
}

export function getSdJwtSigner(agentContext: AgentContext, key: PublicJwk): Signer {
  const kms = agentContext.resolve(KeyManagementApi)

  return async (input: string) => {
    const result = await kms.sign({
      keyId: key.keyId,
      data: TypedArrayEncoder.fromUtf8String(input),
      algorithm: key.signatureAlgorithm,
    })

    return TypedArrayEncoder.toBase64Url(result.signature)
  }
}

export function getSdJwtVerifier(agentContext: AgentContext, key: PublicJwk): Verifier {
  const kms = agentContext.resolve(KeyManagementApi)

  return async (message: string, signatureBase64Url: string) => {
    const result = await kms.verify({
      signature: TypedArrayEncoder.fromBase64Url(signatureBase64Url),
      key: {
        publicJwk: key.toJson(),
      },
      data: TypedArrayEncoder.fromUtf8String(message),
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

function parseX5cHeader(header: Record<string, unknown>) {
  if (!Array.isArray(header.x5c)) {
    throw new SdJwtVcError('Invalid x5c header in credential. Not an array.')
  }
  if (header.x5c.length === 0) {
    throw new SdJwtVcError('Invalid x5c header in credential. Empty array.')
  }
  if (header.x5c.some((x5c) => typeof x5c !== 'string')) {
    throw new SdJwtVcError('Invalid x5c header in credential. Not an array of strings.')
  }

  return (header.x5c as string[]).map((cert) => X509Certificate.fromEncodedCertificate(cert))
}

function parseDidUrlFromKid(iss: string, kid: string) {
  if (kid.startsWith('#')) {
    return `${iss}${kid}`
  }

  if (kid.startsWith('did:')) {
    const didFromKid = parseDid(kid)
    if (didFromKid.did !== iss) {
      throw new SdJwtVcError(
        `kid in header is an absolute DID URL, but the did (${didFromKid.did}) does not match with the 'iss' did (${iss})`
      )
    }

    return kid
  }

  throw new SdJwtVcError(
    'Invalid issuer kid for did. Only absolute or relative (starting with #) did urls are supported.'
  )
}

export function parseIssuerFromCredential(
  header?: Record<string, unknown>,
  payload?: Record<string, unknown>
): SdJwtVcIssuer {
  if (!payload || !header) throw new SdJwtVcError('SD-JWT is missing payload')
  const iss = payload.iss as string | undefined

  // A did:x509 issuer is bound to the did in `iss`, the `x5c` header is only the evidence to resolve that did.
  // It must therefore never be handled as a plain x5c issuer, which would ignore `iss`.
  if (iss && isDidX509(iss)) {
    if (!header.kid || typeof header.kid !== 'string') {
      throw new SdJwtVcError(
        "Credential with a did:x509 issuer does not contain a kid in the header. A kid referencing a key in the did document is required, the 'x5c' header alone is not enough."
      )
    }
    if (!header.x5c) {
      throw new SdJwtVcError(
        "Credential with a did:x509 issuer does not contain an 'x5c' header. The certificate chain is required to resolve the did."
      )
    }

    return {
      method: 'did',
      didUrl: parseDidUrlFromKid(iss, header.kid),
      x5c: parseX5cHeader(header),
    }
  }

  if (header?.x5c) {
    return {
      method: 'x5c',
      x5c: parseX5cHeader(header),
      issuer: iss,
    }
  }

  if (iss?.startsWith('did:')) {
    // If `did` is used, we require a relative KID to be present to identify
    // the key used by issuer to sign the sd-jwt-vc
    if (!header.kid) {
      throw new SdJwtVcError('Credential does not contain a kid in the header')
    }

    return {
      method: 'did',
      didUrl: parseDidUrlFromKid(iss, header.kid as string),
    }
  }

  throw new SdJwtVcError('Unsupported signing method for SD-JWT VC. Only did and x5c are supported at the moment.')
}
