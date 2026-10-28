import { AgentContext } from '../../agent'
import { CredoError } from '../../error'
import { asArray, isDid } from '../../utils'
import { type DidPurpose, DidsApi, getPublicJwkFromVerificationMethod, parseDid } from '../dids'
import { type KnownJwaSignatureAlgorithm } from '../kms'
import { extractKeyFromHolderBinding, parseHolderBindingFromCredential } from '../sd-jwt-vc/utils'
import { W3cV2JwtVerifiableCredential } from './jwt-vc/W3cV2JwtVerifiableCredential'
import { W3cV2JwtVerifiablePresentation } from './jwt-vc/W3cV2JwtVerifiablePresentation'
import { W3cV2EnvelopedVerifiableCredential } from './models/credential/W3cV2EnvelopedVerifiableCredential'
import type { W3cV2Presentation } from './models/presentation/W3cV2Presentation'
import { resolveJwtSigner } from './resolveSigner'
import { W3cV2SdJwtVerifiableCredential } from './sd-jwt-vc/W3cV2SdJwtVerifiableCredential'
import { W3cV2SdJwtVerifiablePresentation } from './sd-jwt-vc/W3cV2SdJwtVerifiablePresentation'

export async function validateAndResolveVerificationMethod(
  agentContext: AgentContext,
  verificationMethod: string,
  allowsPurposes?: DidPurpose[]
) {
  if (!isDid(verificationMethod)) {
    throw new CredoError('Only did identifiers are supported as verification method')
  }

  const parsedDid = parseDid(verificationMethod)
  if (!parsedDid.fragment) {
    throw new CredoError(`didUrl '${parsedDid.didUrl}' does not contain a '#'. Unable to derive key from did document`)
  }

  const dids = agentContext.resolve(DidsApi)
  const { didDocument, keys } = await dids.resolveCreatedDidDocumentWithKeys(parsedDid.did)
  const verificationMethodObject = didDocument.dereferenceKey(verificationMethod, allowsPurposes)
  const publicJwk = getPublicJwkFromVerificationMethod(verificationMethodObject)

  publicJwk.keyId =
    keys?.find(({ didDocumentRelativeKeyId }) => verificationMethodObject.id.endsWith(didDocumentRelativeKeyId))
      ?.kmsKeyId ?? publicJwk.legacyKeyId

  return publicJwk
}

export async function extractHolderFromPresentationCredentials(
  agentContext: AgentContext,
  presentation: W3cV2Presentation
) {
  const credentials = asArray(presentation.verifiableCredential)

  const holderDid = presentation.holderId
  if (holderDid) {
    if (!isDid(holderDid)) {
      throw new CredoError(`Presentation holder '${holderDid}' is not a valid did`)
    }

    const dids = agentContext.resolve(DidsApi)
    const { didDocument, keys } = await dids.resolveCreatedDidDocumentWithKeys(holderDid)

    const authenticationMethods = didDocument.findVerificationMethodsByPurpose(['authentication'])

    const candidateMethods = authenticationMethods.filter((method) =>
      keys?.some(({ didDocumentRelativeKeyId }) => method.id.endsWith(didDocumentRelativeKeyId))
    )

    if (candidateMethods.length === 0) {
      throw new CredoError(
        `Unable to determine signer key for presentation holder '${holderDid}'. No locally controlled authentication verification method found.`
      )
    }

    if (candidateMethods.length > 1) {
      throw new CredoError(
        `Unable to deterministically resolve signer key for presentation holder '${holderDid}'. Multiple locally controlled authentication verification methods found.`
      )
    }

    const selectedMethod = candidateMethods[0]
    const publicJwk = getPublicJwkFromVerificationMethod(selectedMethod)
    publicJwk.keyId =
      keys?.find(({ didDocumentRelativeKeyId }) => selectedMethod.id.endsWith(didDocumentRelativeKeyId))?.kmsKeyId ??
      publicJwk.legacyKeyId

    const [alg] = publicJwk.supportedSignatureAlgorithms
    if (!alg) {
      throw new CredoError(
        `No supported JWA signature algorithms found for holder verification method '${selectedMethod.id}'`
      )
    }

    return {
      alg,
      publicJwk,
      cnf: {
        kid: selectedMethod.id,
      },
    }
  }

  const fallbackHolders: Array<Awaited<ReturnType<typeof extractKeyFromHolderBinding>>> = []

  for (const credential of credentials) {
    if (!(credential instanceof W3cV2EnvelopedVerifiableCredential)) continue

    let claims: Record<string, unknown>
    if (credential.envelopedCredential instanceof W3cV2SdJwtVerifiableCredential) {
      claims = credential.envelopedCredential.sdJwt.prettyClaims
    } else if (credential.envelopedCredential instanceof W3cV2JwtVerifiableCredential) {
      claims = credential.envelopedCredential.jwt.payload.toJson()
    } else {
      continue
    }

    const holderBinding = parseHolderBindingFromCredential(claims)
    if (!holderBinding) continue

    fallbackHolders.push(await extractKeyFromHolderBinding(agentContext, holderBinding, { forSigning: true }))
  }

  if (fallbackHolders.length === 0) {
    throw new CredoError('Unable to determine signer from presentation credentials, and presentation.holder is missing')
  }

  const uniqueFallbackHolders = new Map(fallbackHolders.map((holder) => [holder.publicJwk.fingerprint, holder]))
  if (uniqueFallbackHolders.size > 1) {
    throw new CredoError(
      'Unable to determine signer from presentation credentials. Multiple distinct holder bindings found and presentation.holder is missing.'
    )
  }

  return uniqueFallbackHolders.values().next().value as Awaited<ReturnType<typeof extractKeyFromHolderBinding>>
}

/**
 * Resolves the signer of a JWT credential or presentation. When no `iss` is present, the `issuer`
 * of a credential or the `holder` of a presentation must be the signer.
 */
export async function getSignerForJwt(
  agentContext: AgentContext,
  credential:
    | W3cV2JwtVerifiableCredential
    | W3cV2JwtVerifiablePresentation
    | W3cV2SdJwtVerifiableCredential
    | W3cV2SdJwtVerifiablePresentation,
  purpose: DidPurpose[]
) {
  if (credential instanceof W3cV2JwtVerifiableCredential) {
    return resolveJwtSigner(agentContext, {
      alg: credential.jwt.header.alg as KnownJwaSignatureAlgorithm,
      kid: credential.jwt.header.kid,
      iss: credential.jwt.payload.iss ?? credential.resolvedCredential.issuerId,
      purpose,
    })
  }
  if (credential instanceof W3cV2JwtVerifiablePresentation) {
    return resolveJwtSigner(agentContext, {
      alg: credential.jwt.header.alg as KnownJwaSignatureAlgorithm,
      kid: credential.jwt.header.kid,
      iss: credential.jwt.payload.iss ?? credential.resolvedPresentation.holderId,
      purpose,
    })
  }
  if (credential instanceof W3cV2SdJwtVerifiableCredential) {
    return resolveJwtSigner(agentContext, {
      alg: credential.sdJwt.header.alg as KnownJwaSignatureAlgorithm,
      kid: credential.sdJwt.header.kid,
      iss: credential.sdJwt.payload.iss ?? credential.resolvedCredential.issuerId,
      purpose,
    })
  }
  return resolveJwtSigner(agentContext, {
    alg: credential.sdJwt.header.alg as KnownJwaSignatureAlgorithm,
    kid: credential.sdJwt.header.kid,
    iss: credential.sdJwt.payload.iss ?? credential.resolvedPresentation.holderId,
    purpose,
  })
}
