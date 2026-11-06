import type { W3cDataIntegrityProcessingIssue } from '../W3cDataIntegrityError'
import { createIssue, W3cDataIntegrityProcessingErrorCode } from '../W3cDataIntegrityError'
import type { W3cDataIntegrityCryptosuiteProof } from '../W3cDataIntegrityProof'

/**
 * Implements VC Data Integrity v1.0 §4.5 steps 3.2-3.3 chain-structure validation.
 */
export function validateProofChainStructure(
  proofs: W3cDataIntegrityCryptosuiteProof[]
): W3cDataIntegrityProcessingIssue[] {
  const proofIdToIndexList = new Map<string, number[]>()
  const proofIdToUniqueIndex = new Map<string, number>()
  const issues: W3cDataIntegrityProcessingIssue[] = []

  for (const [index, proof] of proofs.entries()) {
    const proofId = 'id' in proof && typeof proof.id === 'string' ? proof.id : undefined
    if (!proofId) continue

    const existing = proofIdToIndexList.get(proofId)
    if (existing) {
      existing.push(index)
    } else {
      proofIdToIndexList.set(proofId, [index])
      proofIdToUniqueIndex.set(proofId, index)
    }
  }

  for (const [proofId, indices] of proofIdToIndexList.entries()) {
    if (indices.length > 1) {
      proofIdToUniqueIndex.delete(proofId)
      issues.push(
        createIssue(
          W3cDataIntegrityProcessingErrorCode.ProofVerificationError,
          'Duplicate proof id in proof set',
          `Duplicate proof id '${proofId}' at indices ${indices.join(', ')}`
        )
      )
    }
  }

  for (const [index, proof] of proofs.entries()) {
    const previousProofReferences = proof.previousProof
      ? Array.isArray(proof.previousProof)
        ? proof.previousProof
        : [proof.previousProof]
      : []

    for (const previousProofReference of previousProofReferences) {
      const referencedProofIndex = proofIdToUniqueIndex.get(previousProofReference)

      if (referencedProofIndex === undefined) {
        const duplicateReferenceIndices = proofIdToIndexList.get(previousProofReference)
        const resolutionDetail = duplicateReferenceIndices
          ? `Reference '${previousProofReference}' is ambiguous due to duplicate proof ids at indices ${duplicateReferenceIndices.join(', ')}`
          : `Reference '${previousProofReference}' is not present in this proof set`

        issues.push(
          createIssue(
            W3cDataIntegrityProcessingErrorCode.ProofVerificationError,
            'Proof previousProof reference could not be resolved',
            resolutionDetail
          )
        )
        continue
      }

      if (referencedProofIndex >= index) {
        issues.push(
          createIssue(
            W3cDataIntegrityProcessingErrorCode.ProofVerificationError,
            'Proof previousProof reference must target an earlier proof',
            `Reference targets proof index ${referencedProofIndex}, current proof index ${index}`
          )
        )
      }
    }
  }

  if (issues.length > 0) {
    return issues
  }

  return []
}
