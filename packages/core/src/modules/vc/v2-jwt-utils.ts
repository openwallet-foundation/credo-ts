import { AgentContext } from '../../agent'
import { CredoError, RecordNotFoundError } from '../../error'
import { asArray, isDid } from '../../utils'
import {
  type DidPurpose,
  DidsApi,
  getPublicJwkFromVerificationMethod,
  parseDid,
  type VerificationMethod,
} from '../dids'
import { type KnownJwaSignatureAlgorithm, type PublicJwk } from '../kms'
import { extractKeyFromHolderBinding, parseHolderBindingFromCredential } from '../sd-jwt-vc/utils'
import { W3cV2DataIntegrityVerifiableCredential } from './data-integrity/W3cV2DataIntegrityVerifiableCredential'
import { W3cV2JwtVerifiableCredential } from './jwt-vc/W3cV2JwtVerifiableCredential'
import { W3cV2JwtVerifiablePresentation } from './jwt-vc/W3cV2JwtVerifiablePresentation'
import { W3cV2EnvelopedVerifiableCredential } from './models/credential/W3cV2EnvelopedVerifiableCredential'
import type { W3cV2Presentation, W3cV2PresentationCredentialEntry } from './models/presentation/W3cV2Presentation'
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

/**
 * Resolves the DID and key that sign a VCDM 2.0 JWT or SD-JWT presentation so that it satisfies every
 * rule the verifier applies, and throws when they cannot all be met:
 *
 * - The signer DID is the `holder` if set. Else it is the `credentialSubject.id` shared by all
 *   credentials that have one (narrowed to the `cnf.kid` DIDs when they share several). Else it is
 *   the DID of the credentials' `cnf.kid`.
 * - The signer DID is the `id` of its resolved DID document. It must equal the `holder` (if set), and
 *   be one of the `credentialSubject.id`s of every credential that has any.
 * - The signing key is the key all `cnf`s resolve to (a `cnf.kid` is resolved under `authentication`),
 *   else the single local `authentication` method of the signer DID.
 * - The key must be a local `authentication` method of the signer DID, controlled by that DID. The
 *   `kid` is its absolute id, so the verifier needs no `iss`.
 * - The signer DID must be a DID created by this agent, and signing throws instead of guessing when
 *   more than one DID or key would fit.
 */
export async function resolvePresentationSigner(
  agentContext: AgentContext,
  presentation: W3cV2Presentation
): Promise<{ alg: KnownJwaSignatureAlgorithm; publicJwk: PublicJwk; cnf: { kid: string } }> {
  const credentials = asArray(presentation.verifiableCredential)
  const credentialSubjectIds = credentials.map(getCredentialSubjectIds).filter((subjectIds) => subjectIds.length > 0)
  const holderBindings = credentials.flatMap((credential) => getHolderBinding(credential) ?? [])
  const boundDids = Array.from(
    new Set(holderBindings.flatMap((binding) => (binding.method === 'did' ? [parseDid(binding.didUrl).did] : [])))
  )

  const holderDid = presentation.holderId ?? selectSignerDid(credentialSubjectIds, boundDids)
  const party = presentation.holderId ? 'holder' : 'signer'
  if (!isDid(holderDid)) {
    throw new CredoError(`Presentation ${party} '${holderDid}' is not a valid did`)
  }

  const dids = agentContext.resolve(DidsApi)
  const { keys } = await dids.resolveCreatedDidDocumentWithKeys(holderDid).catch((error) => {
    throw error instanceof RecordNotFoundError
      ? new CredoError(`Presentation ${party} '${holderDid}' is not a did created by this agent`, { cause: error })
      : error
  })
  const didDocument = await dids.resolveDidDocument(holderDid)
  const signerDid = didDocument.id

  if (presentation.holderId && presentation.holderId !== signerDid) {
    throw new CredoError(`Presentation holder '${holderDid}' is not the id of its did document '${signerDid}'`)
  }

  if (credentialSubjectIds.some((subjectIds) => !subjectIds.includes(signerDid))) {
    throw new CredoError(
      `Presentation ${party} '${signerDid}' is not a credentialSubject.id of every presentation credential that has one`
    )
  }

  const getKmsKeyId = (method: VerificationMethod) =>
    keys?.find(({ didDocumentRelativeKeyId }) => method.id.endsWith(didDocumentRelativeKeyId))?.kmsKeyId

  // A did record without keys predates kms key ids, and signs with the legacy key id
  const localMethods = didDocument
    .findVerificationMethodsByPurpose(['authentication'])
    .filter(
      (method) =>
        method.controller === signerDid &&
        (method.id.startsWith('#') || method.id.startsWith(`${signerDid}#`)) &&
        (!keys || getKmsKeyId(method))
    )

  if (localMethods.length === 0) {
    throw new CredoError(
      `Unable to determine signer key for presentation ${party} '${holderDid}'. No locally controlled authentication verification method found.`
    )
  }

  const notBoundError = (cause?: Error) =>
    new CredoError(
      localMethods.length > 1
        ? `Unable to deterministically resolve signer key for presentation ${party} '${holderDid}'. Multiple locally controlled authentication verification methods found, and the presentation credentials are not bound to any of them.`
        : `Unable to determine signer key for presentation ${party} '${holderDid}'. The presentation credentials are bound to a key that is not a locally controlled authentication verification method of the ${party}.`,
      { cause }
    )

  const boundKeys = new Map<string, PublicJwk>()
  for (const holderBinding of holderBindings) {
    const { publicJwk } = await extractKeyFromHolderBinding(agentContext, holderBinding, {
      didPurposes: ['authentication'],
    }).catch((error) => {
      throw holderBinding.method === 'did' ? notBoundError(error) : error
    })
    boundKeys.set(publicJwk.fingerprint, publicJwk)
  }

  if (boundKeys.size > 1) {
    throw new CredoError(
      `Unable to determine signer key for presentation ${party} '${holderDid}'. The presentation credentials are bound to more than one key.`
    )
  }

  const [boundKey] = boundKeys.values()
  const candidateMethods = boundKey
    ? localMethods.filter((method) => getPublicJwkFromVerificationMethod(method).equals(boundKey))
    : localMethods

  if (candidateMethods.length === 0 || (!boundKey && candidateMethods.length > 1)) throw notBoundError()

  if (candidateMethods.length > 1) {
    throw new CredoError(
      `Unable to deterministically resolve signer key for presentation ${party} '${holderDid}'. Multiple locally controlled authentication verification methods found, and the presentation credentials are bound to more than one of them.`
    )
  }

  const [selectedMethod] = candidateMethods
  const publicJwk = getPublicJwkFromVerificationMethod(selectedMethod)
  publicJwk.keyId = getKmsKeyId(selectedMethod) ?? publicJwk.legacyKeyId

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
      // Some DID documents (e.g. did:peer:4) use relative ids, while a cnf kid is always absolute
      kid: selectedMethod.id.startsWith('#') ? `${signerDid}${selectedMethod.id}` : selectedMethod.id,
    },
  }
}

function selectSignerDid(credentialSubjectIds: string[][], boundDids: string[]): string {
  if (credentialSubjectIds.length > 0) {
    const sharedSubjectIds = Array.from(new Set(credentialSubjectIds.flat())).filter((subjectId) =>
      credentialSubjectIds.every((subjectIds) => subjectIds.includes(subjectId))
    )
    if (sharedSubjectIds.length === 0) {
      throw new CredoError(
        'Unable to determine signer from presentation credentials, and presentation.holder is missing. The credentials do not share a credentialSubject.id.'
      )
    }

    const candidates =
      sharedSubjectIds.length > 1
        ? sharedSubjectIds.filter((subjectId) => boundDids.includes(subjectId))
        : sharedSubjectIds
    if (candidates.length !== 1) {
      throw new CredoError(
        'Unable to determine signer from presentation credentials, and presentation.holder is missing. The credentials share more than one credentialSubject.id, and their cnf does not select one.'
      )
    }

    return candidates[0]
  }

  if (boundDids.length === 0) {
    throw new CredoError('Unable to determine signer from presentation credentials, and presentation.holder is missing')
  }

  if (boundDids.length > 1) {
    throw new CredoError(
      'Unable to determine signer from presentation credentials. Multiple distinct holder bindings found and presentation.holder is missing.'
    )
  }

  return boundDids[0]
}

function getCredentialSubjectIds(credential: W3cV2PresentationCredentialEntry): string[] {
  if (
    credential instanceof W3cV2EnvelopedVerifiableCredential ||
    credential instanceof W3cV2DataIntegrityVerifiableCredential
  ) {
    return credential.resolvedCredential.credentialSubjectIds
  }

  return []
}

function getHolderBinding(credential: W3cV2PresentationCredentialEntry) {
  if (!(credential instanceof W3cV2EnvelopedVerifiableCredential)) return null

  if (credential.envelopedCredential instanceof W3cV2SdJwtVerifiableCredential) {
    return parseHolderBindingFromCredential(credential.envelopedCredential.sdJwt.prettyClaims)
  }
  if (credential.envelopedCredential instanceof W3cV2JwtVerifiableCredential) {
    return parseHolderBindingFromCredential(credential.envelopedCredential.jwt.payload.toJson())
  }

  return null
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
