import { describe, expect, test, vi } from 'vitest'
import { getAgentConfig, getAgentContext } from '../../../../../tests/helpers'
import type { AgentContext } from '../../../../agent/context'
import { MultiBaseEncoder } from '../../../../utils/MultiBaseEncoder'
import { TypedArrayEncoder } from '../../../../utils/TypedArrayEncoder'
import { DidsApi } from '../../../dids'
import {
  type W3cDataIntegrityCryptosuiteProof as DataIntegrityCryptosuiteProof,
  W3cDataIntegrityProcessingErrorCode as DataIntegrityProcessingErrorCode,
} from '../../../w3c-di/internal'
import { W3cDataIntegrityProofPurposeValidator } from '../W3cDataIntegrityProofPurposeValidator'

const validProofValue = MultiBaseEncoder.encode(TypedArrayEncoder.fromUtf8String('proof-value'), 'base58btc')

describe('proofPurpose', () => {
  test('rejects unsupported proof purposes', async () => {
    const validator = new W3cDataIntegrityProofPurposeValidator()
    const agentContext = getAgentContext({
      agentConfig: getAgentConfig('W3cDataIntegrityProofPurposeValidatorTest'),
    })

    const result = await validator.validate(agentContext as AgentContext, {
      type: 'DataIntegrityProof',
      cryptosuite: 'eddsa-jcs-2022',
      verificationMethod: 'did:example:123#key-1',
      proofPurpose: 'unsupportedPurpose',
      proofValue: validProofValue,
    })

    expect(result?.verified).toBe(false)
    expect(result?.errors[0]?.type).toBe(DataIntegrityProcessingErrorCode.ProofVerificationError)
  })

  test('rejects verification methods not authorised for proof purpose', async () => {
    const resolveDidDocument = vi.fn().mockResolvedValue({
      dereferenceKey: vi.fn().mockImplementation(() => {
        throw new Error('Verification method is not in assertionMethod relationship')
      }),
    })

    const validator = new W3cDataIntegrityProofPurposeValidator()
    const agentContext = getAgentContext({
      agentConfig: getAgentConfig('W3cDataIntegrityProofPurposeValidatorTest'),
      registerInstances: [[DidsApi, { resolveDidDocument }]],
    })

    const result = await validator.validate(agentContext as AgentContext, {
      type: 'DataIntegrityProof',
      cryptosuite: 'eddsa-jcs-2022',
      verificationMethod: 'did:example:123#key-1',
      proofPurpose: 'assertionMethod',
      proofValue: validProofValue,
    })

    expect(result?.verified).toBe(false)
    expect(result?.errors[0]?.type).toBe(DataIntegrityProcessingErrorCode.ProofVerificationError)
  })

  test('rejects missing verificationMethod for proof purpose validation', async () => {
    const resolveDidDocument = vi.fn()

    const validator = new W3cDataIntegrityProofPurposeValidator()
    const agentContext = getAgentContext({
      agentConfig: getAgentConfig('W3cDataIntegrityProofPurposeValidatorTest'),
      registerInstances: [[DidsApi, { resolveDidDocument }]],
    })

    const result = await validator.validate(
      agentContext as AgentContext,
      {
        type: 'DataIntegrityProof',
        cryptosuite: 'eddsa-jcs-2022',
        proofPurpose: 'assertionMethod',
        proofValue: validProofValue,
      } as unknown as DataIntegrityCryptosuiteProof
    )

    expect(result?.verified).toBe(false)
    expect(result?.errors[0]?.type).toBe(DataIntegrityProcessingErrorCode.ProofVerificationError)
    expect(resolveDidDocument).not.toHaveBeenCalled()
  })

  test('rejects non-string verificationMethod for proof purpose validation', async () => {
    const resolveDidDocument = vi.fn()

    const validator = new W3cDataIntegrityProofPurposeValidator()
    const agentContext = getAgentContext({
      agentConfig: getAgentConfig('W3cDataIntegrityProofPurposeValidatorTest'),
      registerInstances: [[DidsApi, { resolveDidDocument }]],
    })

    const result = await validator.validate(
      agentContext as AgentContext,
      {
        type: 'DataIntegrityProof',
        cryptosuite: 'eddsa-jcs-2022',
        verificationMethod: { id: 'did:example:123#key-1' },
        proofPurpose: 'assertionMethod',
        proofValue: validProofValue,
      } as unknown as DataIntegrityCryptosuiteProof
    )

    expect(result?.verified).toBe(false)
    expect(result?.errors[0]?.type).toBe(DataIntegrityProcessingErrorCode.ProofVerificationError)
    expect(resolveDidDocument).not.toHaveBeenCalled()
  })
})
