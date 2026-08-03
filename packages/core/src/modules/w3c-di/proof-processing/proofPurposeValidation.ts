import type { AgentContext } from '../../../agent/context'
import { type DidPurpose, DidsApi } from '../../dids'
import {
  createInvalidResult,
  createProofVerificationIssue,
  type W3cDataIntegrityVerifyFailure,
} from '../W3cDataIntegrityError'
import type { W3cDataIntegrityCryptosuiteProof } from '../W3cDataIntegrityProof'

const DID_PROOF_PURPOSES: DidPurpose[] = [
  'assertionMethod',
  'authentication',
  'keyAgreement',
  'capabilityInvocation',
  'capabilityDelegation',
]

function asDidPurpose(proofPurpose: string): DidPurpose | undefined {
  return (DID_PROOF_PURPOSES as string[]).includes(proofPurpose) ? (proofPurpose as DidPurpose) : undefined
}

/**
 * Validates that the verificationMethod used in a proof is authorised for
 * the proofPurpose verification relationship in the controller document.
 */
export async function validateProofPurposeVerificationRelationship(
  agentContext: AgentContext,
  proof: W3cDataIntegrityCryptosuiteProof
): Promise<W3cDataIntegrityVerifyFailure | undefined> {
  if (typeof proof.verificationMethod !== 'string') {
    return createInvalidResult(
      createProofVerificationIssue(
        'Proof verificationMethod is required for proof purpose validation',
        `Received '${typeof proof.verificationMethod}'`
      )
    )
  }

  const verificationRelationship = asDidPurpose(proof.proofPurpose)

  if (!verificationRelationship) {
    return createInvalidResult(
      createProofVerificationIssue(
        'Unsupported proof purpose for verification relationship validation',
        `Proof purpose '${proof.proofPurpose}' is not one of ${DID_PROOF_PURPOSES.join(', ')}`
      )
    )
  }

  const didApi = agentContext.dependencyManager.resolve(DidsApi)

  try {
    const didDocument = await didApi.resolveDidDocument(proof.verificationMethod)
    didDocument.dereferenceKey(proof.verificationMethod, [verificationRelationship])
  } catch (error) {
    return createInvalidResult(
      createProofVerificationIssue(
        'Verification method is not authorised for proof purpose',
        error instanceof Error
          ? error.message
          : `Verification method '${proof.verificationMethod}' is not authorised for proof purpose '${proof.proofPurpose}'`
      )
    )
  }

  return undefined
}
