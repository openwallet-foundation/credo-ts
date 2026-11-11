import type { AgentContext } from '../../agent'
import { CredoError } from '../../error'
import { isDid } from '../../utils'
import { type DidPurpose, DidsApi, type VerificationMethod } from '../dids'
import { getSupportedVerificationMethodTypesForPublicJwk } from '../dids/domain/key-type/keyDidMapping'
import { type KnownJwaSignatureAlgorithm, PublicJwk } from '../kms'
import type { SingleValidationResult } from './models/W3cVerifyResult'

export interface ResolvedSigner {
  verificationMethod: VerificationMethod

  /** The DID of the DID document that lists and controls `verificationMethod` */
  signer: string
}

/**
 * Resolves the verification method of a signature and the DID that signed with it, following
 * Controlled Identifiers 1.0 §3.3 ("Retrieve Verification Method"). The verification method must be
 * listed under `purpose` in the DID document of its own DID, and be controlled by that DID.
 *
 * @param purpose omit when the proof purpose is already validated
 */
export async function resolveSigner(
  agentContext: AgentContext,
  verificationMethodId: string,
  purpose?: DidPurpose[]
): Promise<ResolvedSigner> {
  const didDocument = await agentContext.dependencyManager.resolve(DidsApi).resolveDidDocument(verificationMethodId)

  const verificationMethod = didDocument.dereferenceKey(verificationMethodId, purpose)
  assertControlledByDid(verificationMethod, didDocument.id)

  return { verificationMethod, signer: didDocument.id }
}

/**
 * Resolves the signer of a JWT from its `kid`, or from the `iss` and `alg` when there is no
 * `kid`. When `iss` is present, it must be the signer.
 */
export async function resolveJwtSigner(
  agentContext: AgentContext,
  { kid, iss, alg, purpose }: { kid?: string; iss?: string; alg: KnownJwaSignatureAlgorithm; purpose: DidPurpose[] }
): Promise<ResolvedSigner> {
  let resolved: ResolvedSigner

  if (kid?.startsWith('#')) {
    if (!iss || !isDid(iss)) {
      throw new CredoError(`JWT 'iss' MUST be a did when 'kid' is a relative did url`)
    }

    resolved = await resolveSigner(agentContext, `${iss}${kid}`, purpose)
  } else if (kid && isDid(kid)) {
    resolved = await resolveSigner(agentContext, kid, purpose)
  } else {
    if (!iss) {
      throw new CredoError(`JWT 'iss' MUST be present in payload when no 'kid' is specified`)
    }

    const jwkClass = PublicJwk.supportedPublicJwkClassForSignatureAlgorithm(alg)
    const didDocument = await agentContext.dependencyManager.resolve(DidsApi).resolveDidDocument(iss)
    const verificationMethods = didDocument.findVerificationMethodsByTypeAndPurpose(
      getSupportedVerificationMethodTypesForPublicJwk(jwkClass),
      purpose
    )

    if (verificationMethods.length !== 1) {
      throw new CredoError(
        `${verificationMethods.length === 0 ? 'No' : 'Multiple'} verification methods found for signer '${iss}' and key type '${jwkClass.name}' for alg '${alg}'. Unable to determine which public key is associated with the JWT.`
      )
    }

    assertControlledByDid(verificationMethods[0], didDocument.id)
    resolved = { verificationMethod: verificationMethods[0], signer: didDocument.id }
  }

  if (iss && resolved.signer !== iss) {
    throw new CredoError(`JWT is signed by '${resolved.signer}', but its 'iss' is '${iss}'`)
  }

  return resolved
}

/**
 * Validates that the `issuer` of a credential or the `holder` of a presentation is the signer. A
 * missing `holder` makes no claim, so it passes.
 */
export function validateSignerIsExpectedParty(
  { verificationMethod, signer }: ResolvedSigner,
  expectedSigner: string | null | undefined,
  role: 'issuer' | 'holder'
): SingleValidationResult {
  if (!expectedSigner || signer === expectedSigner) return { isValid: true }

  const description =
    role === 'issuer'
      ? `Credential is signed using verification method ${verificationMethod.id}, while the issuer of the credential is '${expectedSigner}'`
      : `Presentation is signed using verification method ${verificationMethod.id}, while the holder of the presentation is '${expectedSigner}'`

  return { isValid: false, error: new CredoError(description) }
}

/**
 * A DID document can name any controller for its keys, so only the DID of the document that lists
 * the verification method is accepted.
 */
export function assertControlledByDid(verificationMethod: { id: string; controller?: unknown }, did: string) {
  if (verificationMethod.controller !== did) {
    throw new CredoError(
      `Verification method '${verificationMethod.id}' is controlled by '${verificationMethod.controller}', not by the DID document '${did}' it is listed in`
    )
  }
}
