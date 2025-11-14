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
import { W3cV2JwtVerifiableCredential, W3cV2JwtVerifiablePresentation } from './jwt-vc'
import { W3cV2Presentation } from './models'
import { W3cV2SdJwtVerifiableCredential, W3cV2SdJwtVerifiablePresentation } from './sd-jwt-vc'

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
  // At the moment, we only support signing presentations with a single credential
  // Technically, it should be possible to support more than a single one. However,
  // in the context we support (OID4VP) it doesn't make sense to support multiple ones.
  const credentials = asArray(presentation.verifiableCredential)
  if (credentials.length !== 1) {
    throw new CredoError('Only a single verifiable credential is supported in a presentation')
  }

  const credential = credentials[0]
  let claims: Record<string, unknown>

  if (credential.envelopedCredential instanceof W3cV2SdJwtVerifiableCredential) {
    claims = credential.envelopedCredential.sdJwt.prettyClaims
  } else {
    claims = credential.envelopedCredential.jwt.payload.toJson()
  }

  // We require the credential to include a holder binding in the form of a 'cnf' claim
  const holderBinding = parseHolderBindingFromCredential(claims)
  if (!holderBinding) {
    throw new CredoError('No holder binding found in credential included in presentation')
  }

  return await extractKeyFromHolderBinding(agentContext, holderBinding, { forSigning: true })
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
