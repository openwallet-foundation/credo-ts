import { AgentContext } from '../../agent'
import { CredoError } from '../../error'
import { asArray, isDid } from '../../utils'
import {
  type DidPurpose,
  DidResolverService,
  DidsApi,
  getPublicJwkFromVerificationMethod,
  parseDid,
  VerificationMethod,
} from '../dids'
import { getSupportedVerificationMethodTypesForPublicJwk } from '../dids/domain/key-type/keyDidMapping'
import { type KnownJwaSignatureAlgorithm, PublicJwk } from '../kms'
import { extractKeyFromHolderBinding, parseHolderBindingFromCredential } from '../sd-jwt-vc/utils'
import { W3cV2JwtVerifiableCredential } from './jwt-vc/W3cV2JwtVerifiableCredential'
import { W3cV2JwtVerifiablePresentation } from './jwt-vc/W3cV2JwtVerifiablePresentation'
import { W3cV2EnvelopedVerifiableCredential } from './models/credential/W3cV2EnvelopedVerifiableCredential'
import type { W3cV2Presentation } from './models/presentation/W3cV2Presentation'
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

    const authenticationMethods =
      didDocument.authentication
        ?.map((entry) => (typeof entry === 'string' ? didDocument.dereferenceVerificationMethod(entry) : entry))
        .filter((entry): entry is VerificationMethod => !!entry) ?? []

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
 * This method tries to find the verification method associated with the JWT credential or presentation.
 * This verification method can then be used to verify the credential or presentation signature.
 */
export async function getVerificationMethodForJwt(
  agentContext: AgentContext,
  credential:
    | W3cV2JwtVerifiableCredential
    | W3cV2JwtVerifiablePresentation
    | W3cV2SdJwtVerifiableCredential
    | W3cV2SdJwtVerifiablePresentation,
  purpose?: DidPurpose[]
) {
  let alg: KnownJwaSignatureAlgorithm
  let kid: string | undefined
  let iss: string | undefined

  // Determine the algorithm, kid and iss based on the type of credential / presentation
  if (credential instanceof W3cV2JwtVerifiableCredential) {
    alg = credential.jwt.header.alg as KnownJwaSignatureAlgorithm
    kid = credential.jwt.header.kid
    iss = credential.jwt.payload.iss ?? credential.resolvedCredential.issuerId
  } else if (credential instanceof W3cV2JwtVerifiablePresentation) {
    alg = credential.jwt.header.alg as KnownJwaSignatureAlgorithm
    kid = credential.jwt.header.kid
    iss = credential.jwt.payload.iss ?? credential.resolvedPresentation.holderId
  } else if (credential instanceof W3cV2SdJwtVerifiableCredential) {
    alg = credential.sdJwt.header.alg as KnownJwaSignatureAlgorithm
    kid = credential.sdJwt.header.kid
    iss = credential.sdJwt.payload.iss ?? credential.resolvedCredential.issuerId
  } else {
    alg = credential.sdJwt.header.alg as KnownJwaSignatureAlgorithm
    kid = credential.sdJwt.header.kid
    iss = credential.sdJwt.payload.iss ?? credential.resolvedPresentation.holderId
  }

  const didResolver = agentContext.dependencyManager.resolve(DidResolverService)
  let verificationMethod: VerificationMethod

  // If the kid starts with # we assume it is a relative did url, and we resolve
  //it based on the `iss` and the `kid`
  if (kid?.startsWith('#')) {
    if (!iss || !isDid(iss)) {
      throw new CredoError(`JWT 'iss' MUST be a did when 'kid' is a relative did url`)
    }

    const didDocument = await didResolver.resolveDidDocument(agentContext, iss)
    verificationMethod = didDocument.dereferenceKey(`${iss}${kid}`, purpose)
  } else if (kid && isDid(kid)) {
    const didDocument = await didResolver.resolveDidDocument(agentContext, kid)
    verificationMethod = didDocument.dereferenceKey(kid, purpose)

    if (iss && didDocument.id !== iss) {
      throw new CredoError(`kid '${kid}' does not match id of signer (holder/issuer) '${iss}'`)
    }
  } else {
    if (!iss) {
      throw new CredoError(`JWT 'iss' MUST be present in payload when no 'kid' is specified`)
    }

    // Find the verificationMethod in the did document based on the alg and proofPurpose
    const jwkClass = PublicJwk.supportedPublicJwkClassForSignatureAlgorithm(alg)
    const supportedVerificationMethodTypes = getSupportedVerificationMethodTypesForPublicJwk(jwkClass)

    const didDocument = await didResolver.resolveDidDocument(agentContext, iss)
    const verificationMethods =
      didDocument.assertionMethod
        ?.map((v) => (typeof v === 'string' ? didDocument.dereferenceVerificationMethod(v) : v))
        .filter((v) => supportedVerificationMethodTypes.includes(v.type)) ?? []

    if (verificationMethods.length === 0) {
      throw new CredoError(
        `No verification methods found for signer '${iss}' and key type '${jwkClass.name}' for alg '${alg}'. Unable to determine which public key is associated with the credential.`
      )
    }
    if (verificationMethods.length > 1) {
      throw new CredoError(
        `Multiple verification methods found for signer '${iss}' and key type '${jwkClass.name}' for alg '${alg}'. Unable to determine which public key is associated with the credential.`
      )
    }

    verificationMethod = verificationMethods[0]
  }

  // Verify the controller of the verificationMethod matches the signer of the credential
  if (iss && verificationMethod.controller !== iss) {
    throw new CredoError(
      `Verification method controller '${verificationMethod.controller}' does not match the signer '${iss}'`
    )
  }

  return verificationMethod
}
