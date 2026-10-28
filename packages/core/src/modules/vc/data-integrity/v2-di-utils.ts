import type { AgentContext } from '../../../agent'
import { CredoError } from '../../../error'
import { asArray } from '../../../utils'
import type { DidPurpose } from '../../dids'
import { tryParseDid } from '../../dids/domain/parse'
import { type ResolvedSigner, resolveSigner } from '../resolveSigner'

/**
 * A Data Integrity proof, narrowed to the properties needed to identify the signer.
 */
type DataIntegrityProof = {
  verificationMethod: string
}

function isDataIntegrityProof(proof: unknown): proof is DataIntegrityProof {
  if (typeof proof !== 'object' || proof === null) return false

  const { verificationMethod } = proof as Record<string, unknown>
  return typeof verificationMethod === 'string'
}

/**
 * The part of a Data Integrity secured document this module needs: the embedded proof or proof
 * set. Both secured credentials and secured presentations satisfy this.
 */
type DataIntegritySecuredDocument = { proof: unknown }

function getProofs(securedDocument: DataIntegritySecuredDocument): DataIntegrityProof[] {
  return asArray(securedDocument.proof).filter(isDataIntegrityProof)
}

/**
 * Resolves the signer of a Data Integrity credential or presentation for an already verified proof
 * or proof set.
 *
 * A `proof` value may be a proof set, which per VC-DATA-INTEGRITY has no order. Its proof purposes
 * have already been validated by w3c-di before this helper is called. Where several proofs name
 * different verification methods, position therefore carries no meaning. `expectedSigner` is
 * used to disambiguate: the proof signed by that identity is selected. This is the co-signature
 * case — several parties sign, and only the one identified as the issuer or holder is relevant here.
 *
 * @param expectedSigner the identity the signer is expected to be, where known — the
 * credential's `issuer` or the presentation's `holder`. Omit when unknown, in which case an
 * ambiguous proof set is rejected rather than resolved arbitrarily.
 *
 * @throws {CredoError} if there is no proof with a verification method, if several verification
 * methods cannot be disambiguated, or if a verification method cannot be resolved or is controlled
 * by another DID.
 */
export async function resolveDataIntegritySigner(
  agentContext: AgentContext,
  securedDocument: DataIntegritySecuredDocument,
  purpose: DidPurpose,
  expectedSigner?: string
): Promise<ResolvedSigner> {
  const proofs = getProofs(securedDocument)

  if (proofs.length === 0) {
    throw new CredoError('Data Integrity secured document does not contain a proof with a verification method')
  }

  const verificationMethodIds = new Set(proofs.map((proof) => proof.verificationMethod))

  if (verificationMethodIds.size === 1) {
    return resolveSigner(agentContext, proofs[0].verificationMethod, [purpose])
  }

  if (!expectedSigner) {
    throw new CredoError(
      `Data Integrity secured document contains multiple proofs with different verification methods (${[...verificationMethodIds].join(', ')}). Unable to determine the signer.`
    )
  }

  // The signer is the DID of the verification method, so the other proofs don't need to be resolved
  const expectedSignerVerificationMethodId = [...verificationMethodIds].find(
    (verificationMethodId) => tryParseDid(verificationMethodId)?.did === expectedSigner
  )

  if (!expectedSignerVerificationMethodId) {
    throw new CredoError(
      `Data Integrity secured document contains multiple proofs, none of which is signed by '${expectedSigner}'`
    )
  }

  return resolveSigner(agentContext, expectedSignerVerificationMethodId, [purpose])
}
