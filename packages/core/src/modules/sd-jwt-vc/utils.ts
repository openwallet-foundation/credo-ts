import type { Signer, Verifier } from '@sd-jwt/types'
import type { SdJwtVcHolderBinding } from './SdJwtVcOptions'

import { AgentContext } from '../../agent'
import { CredoError } from '../../error'
import { TypedArrayEncoder } from '../../utils'
import { DidResolverService, DidsApi, getPublicJwkFromVerificationMethod, parseDid } from '../dids'
import { Jwk, KeyManagementApi, PublicJwk } from '../kms'

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
  forSigning = false
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
      throw new CredoError(`No supported JWA signature algorithms found for key ${publicJwk.jwkTypehumanDescription}`)
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

    // If there is no key id configured when signing, we assume this credential was issued before we included key ids
    // and the we use the legacy key id.
    if (forSigning && !publicJwk.hasKeyId) {
      publicJwk.keyId = publicJwk.legacyKeyId
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
