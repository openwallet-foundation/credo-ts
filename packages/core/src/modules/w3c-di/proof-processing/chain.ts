import type { W3cDataIntegrityProcessingIssue } from '../W3cDataIntegrityError'
import { createIssue, W3cDataIntegrityProcessingErrorCode } from '../W3cDataIntegrityError'
import type { W3cDataIntegrityCryptosuiteProof } from '../W3cDataIntegrityProof'
import { validateProofDependencies } from './validation'

export type BuildValidatedProofReferenceGraphResult =
  | { ok: true; value: Map<number, number[]> }
  | { ok: false; errors: W3cDataIntegrityProcessingIssue[] }

/**
 * Implements VC Data Integrity v1.0 §4.5 steps 3.2-3.3 chain-structure validation.
 */
export function validateProofChainStructure(proofs: W3cDataIntegrityCryptosuiteProof[]): W3cDataIntegrityProcessingIssue[] {
  return validateProofDependencies(proofs)
}

/**
 * Builds and validates proof dependency references for VC Data Integrity v1.0 §4.5.
 */
export function buildValidatedProofReferenceGraph(
  proofs: W3cDataIntegrityCryptosuiteProof[]
): BuildValidatedProofReferenceGraphResult {
  const proofIdToIndexList = new Map<string, number[]>()
  const proofIdToUniqueIndex = new Map<string, number>()
  const proofReferenceGraph = new Map<number, number[]>()
  const issues: W3cDataIntegrityProcessingIssue[] = []

  for (const [index, proof] of proofs.entries()) {
    proofReferenceGraph.set(index, [])

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

    const resolvedReferenceIndices: number[] = []

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

      resolvedReferenceIndices.push(referencedProofIndex)
    }

    proofReferenceGraph.set(index, resolvedReferenceIndices)
  }

  if (hasProofChainCycle(proofReferenceGraph)) {
    issues.push(createIssue(W3cDataIntegrityProcessingErrorCode.ProofVerificationError, 'Proof chain contains a cycle'))
  }

  for (const [index, referenceIndices] of proofReferenceGraph.entries()) {
    for (const referencedProofIndex of referenceIndices) {
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
    return {
      ok: false,
      errors: issues,
    }
  }

  return {
    ok: true,
    value: proofReferenceGraph,
  }
}

/**
 * Detects cycles in a proof chain reference graph using DFS.
 * The graph maps proof indices to the indices of their previousProof references.
 */
export function hasProofChainCycle(referenceGraph: Map<number, number[]>): boolean {
  const visiting = new Set<number>()
  const visited = new Set<number>()

  const visit = (index: number): boolean => {
    if (visiting.has(index)) return true
    if (visited.has(index)) return false

    visiting.add(index)
    const dependencies = referenceGraph.get(index) ?? []
    for (const dependencyIndex of dependencies) {
      if (visit(dependencyIndex)) {
        return true
      }
    }

    visiting.delete(index)
    visited.add(index)
    return false
  }

  for (const index of referenceGraph.keys()) {
    if (visit(index)) {
      return true
    }
  }

  return false
}
