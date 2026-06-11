import type { AgentContext } from '../../../agent/context'
import type { DidPurpose } from '../../dids'
import { DidsApi } from '../../dids'
import {
  createInvalidResult,
  createProofVerificationIssue,
  type W3cDataIntegrityCryptosuiteProof as DataIntegrityCryptosuiteProof,
  type W3cDataIntegrityVerifyFailure as DataIntegrityVerifyFailure,
} from '../../w3c-di/internal'

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

export class W3cV2DataIntegrityProofPurposeValidator {
  public async validate(
    agentContext: AgentContext,
    proof: DataIntegrityCryptosuiteProof
  ): Promise<DataIntegrityVerifyFailure | undefined> {
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
}
