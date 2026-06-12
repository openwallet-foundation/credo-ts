import type { AgentContext } from '../../agent/context'
import { injectable } from '../../plugins'
import { asArray, equalsIgnoreOrder } from '../../utils'
import type { W3cDataIntegrityCryptosuite, W3cDataIntegrityProofVerificationInput } from './cryptosuites/types'
import { validateProofChainStructure } from './proof-processing/chain'
import { omitUndefinedFields } from './proof-processing/normalisation'
import { parseW3cDataIntegrityProofDocument } from './proof-processing/parsing'
import {
  assertCreatedProofPostconditions,
  validateProofFieldFormats,
  validateProofRequiredMembers,
} from './proof-processing/validation'
import { W3cDataIntegrityCryptosuiteRegistry } from './W3cDataIntegrityCryptosuiteRegistry'
import type {
  W3cDataIntegrityCreateFailure,
  W3cDataIntegrityCreateSuccess,
  W3cDataIntegrityProcessingIssue,
  W3cDataIntegrityVerifyFailure,
  W3cDataIntegrityVerifySuccess,
} from './W3cDataIntegrityError'
import {
  createInvalidResult,
  createIssue,
  W3cDataIntegrityProcessingError,
  W3cDataIntegrityProcessingErrorCode,
} from './W3cDataIntegrityError'
import type {
  W3cDataIntegrityCryptosuiteProof,
  W3cDataIntegrityCryptosuiteProofOptions,
  W3cDataIntegrityDomain,
  W3cDataIntegrityPreviousProofReference,
  W3cDataIntegrityProofSetSecuredDocument,
  W3cDataIntegritySingleProofSecuredDocument,
  W3cDataIntegrityUnsecuredDocument,
} from './W3cDataIntegrityProof'
import {
  assertMultiProofDocument,
  assertSingleProofDocument,
  createW3cDataIntegrityProofOptions,
} from './W3cDataIntegrityProof'

export interface W3cDataIntegrityCreateProofOptions {
  unsecuredDocument: W3cDataIntegrityUnsecuredDocument
  verificationMethod: string
  proofPurpose: string
  cryptosuite: string
  created?: string
  expires?: string
  challenge?: string
  domain?: W3cDataIntegrityDomain
  nonce?: string
  previousProof?: W3cDataIntegrityPreviousProofReference
}

export interface W3cDataIntegrityVerifyProofOptions {
  expectedProofPurpose?: string
  domain?: W3cDataIntegrityDomain
  challenge?: string
}

export interface W3cDataIntegrityVerifyProofDocumentOptions extends W3cDataIntegrityVerifyProofOptions {
  mediaType: string
  documentBytes: Uint8Array
}

@injectable()
export class W3cDataIntegrityProofService {
  private dataIntegrityCryptosuiteRegistry: W3cDataIntegrityCryptosuiteRegistry
  private readonly supportedMediaTypes = ['application/json', 'application/ld+json', 'application/vc+ld+json']

  public constructor(dataIntegrityCryptosuiteRegistry: W3cDataIntegrityCryptosuiteRegistry) {
    this.dataIntegrityCryptosuiteRegistry = dataIntegrityCryptosuiteRegistry
  }

  // ─── Create (Result-Based) ────────────────────────────────────────────────

  /**
   * Implements VC Data Integrity v1.0 §4.2 "Add Proof" orchestration.
   * Delegates cryptographic suite proof creation and enforces postconditions.
   */
  public async createProof(
    agentContext: AgentContext,
    options: W3cDataIntegrityCreateProofOptions
  ): Promise<W3cDataIntegrityCreateSuccess | W3cDataIntegrityCreateFailure> {
    const normalisedUnsecuredDocument = omitUndefinedFields(options.unsecuredDocument)

    let cryptosuite: W3cDataIntegrityCryptosuite
    try {
      cryptosuite = this.dataIntegrityCryptosuiteRegistry.createByCryptosuite(agentContext, options.cryptosuite)
    } catch (error) {
      if (!(error instanceof Error)) {
        throw error
      }

      const issue =
        error instanceof W3cDataIntegrityProcessingError
          ? error.issue
          : createIssue(
              W3cDataIntegrityProcessingErrorCode.ProofGenerationError,
              'Error creating Data Integrity proof',
              error.message
            )
      return {
        created: false,
        proof: null,
        errors: [issue],
      }
    }

    const proofOptions: W3cDataIntegrityCryptosuiteProofOptions = createW3cDataIntegrityProofOptions(
      omitUndefinedFields({
        cryptosuite: cryptosuite.cryptosuite,
        verificationMethod: options.verificationMethod,
        proofPurpose: options.proofPurpose,
        created: options.created,
        expires: options.expires,
        challenge: options.challenge,
        domain: options.domain,
        nonce: options.nonce,
        previousProof: options.previousProof,
      })
    )

    try {
      const proof = await cryptosuite.createProof(normalisedUnsecuredDocument, proofOptions)
      assertCreatedProofPostconditions(
        proof,
        { ...proofOptions, verificationMethod: options.verificationMethod },
        cryptosuite.cryptosuite
      )
      return {
        created: true,
        proof,
      }
    } catch (error) {
      if (!(error instanceof Error)) {
        throw error
      }

      const issue =
        error instanceof W3cDataIntegrityProcessingError
          ? error.issue
          : createIssue(
              W3cDataIntegrityProcessingErrorCode.ProofGenerationError,
              'Error creating Data Integrity proof',
              error.message
            )
      return {
        created: false,
        proof: null,
        errors: [issue],
      }
    }
  }

  /**
   * Implements VC Data Integrity v1.0 §4.4 "Verify Proof" algorithm.
   * Steps 4-8 are enforced through required-member gate, policy checks,
   * field-format validation, and cryptosuite verification.
   */
  public async verifyProof(
    agentContext: AgentContext,
    securedDocument: W3cDataIntegritySingleProofSecuredDocument,
    options: W3cDataIntegrityVerifyProofOptions = {}
  ): Promise<W3cDataIntegrityVerifySuccess | W3cDataIntegrityVerifyFailure> {
    try {
      assertSingleProofDocument(securedDocument)

      return await this.verifySingleProofCore(agentContext, securedDocument, options)
    } catch (error) {
      if (!(error instanceof Error)) {
        throw error
      }

      const issue =
        error instanceof W3cDataIntegrityProcessingError
          ? error.issue
          : createIssue(
              W3cDataIntegrityProcessingErrorCode.ProofVerificationError,
              'Error verifying Data Integrity proof',
              error.message
            )
      return createInvalidResult(issue)
    }
  }

  // ─── Verify (Explicit Paths) ──────────────────────────────────────────────

  /**
   * Implements VC Data Integrity v1.0 §4.5 "Verify Proof Sets and Chains" algorithm.
   * Performs chain-structure validation, then verifies each proof against
   * reconstructed dependency-proof input.
   */
  public async verifyProofSetAndChain(
    agentContext: AgentContext,
    securedDocument: W3cDataIntegrityProofSetSecuredDocument,
    options: W3cDataIntegrityVerifyProofOptions = {}
  ): Promise<W3cDataIntegrityVerifySuccess | W3cDataIntegrityVerifyFailure> {
    try {
      assertMultiProofDocument(securedDocument)

      const proofs = securedDocument.proof
      const requiredMemberIssues = proofs
        .map((proof, index) => {
          const requiredMemberValidationError = validateProofRequiredMembers(proof)
          if (!requiredMemberValidationError) return undefined

          return createIssue(
            W3cDataIntegrityProcessingErrorCode.ProofVerificationError,
            `Proof at index ${index} has invalid required members`,
            requiredMemberValidationError
          )
        })
        .filter((issue): issue is ReturnType<typeof createIssue> => issue !== undefined)

      if (requiredMemberIssues.length > 0) {
        return createInvalidResult(requiredMemberIssues[0], requiredMemberIssues.slice(1))
      }

      const proofChainIssues = validateProofChainStructure(proofs)
      if (proofChainIssues.length > 0) {
        return createInvalidResult(proofChainIssues[0], proofChainIssues.slice(1))
      }

      const proofPolicyIssues = proofs
        .map((proof, index) => {
          const proofPolicyIssue = this.validateProofPolicy(proof, options)
          if (!proofPolicyIssue) return undefined

          return createIssue(
            proofPolicyIssue.type,
            `Proof at index ${index} failed verification policy pre-check`,
            proofPolicyIssue.detail ?? proofPolicyIssue.title
          )
        })
        .filter((issue): issue is W3cDataIntegrityProcessingIssue => issue !== undefined)

      if (proofPolicyIssues.length > 0) {
        return createInvalidResult(proofPolicyIssues[0], proofPolicyIssues.slice(1))
      }

      const proofFieldFormatIssues = proofs
        .map((proof, index) => {
          const proofFieldFormatError = validateProofFieldFormats(proof)
          if (!proofFieldFormatError) return undefined

          return createIssue(
            W3cDataIntegrityProcessingErrorCode.ProofVerificationError,
            `Proof at index ${index} has invalid field formats`,
            proofFieldFormatError.errors[0]?.detail ?? proofFieldFormatError.errors[0]?.title
          )
        })
        .filter((issue): issue is W3cDataIntegrityProcessingIssue => issue !== undefined)

      if (proofFieldFormatIssues.length > 0) {
        return createInvalidResult(proofFieldFormatIssues[0], proofFieldFormatIssues.slice(1))
      }

      const proofIdToIndex = this.createProofIdToIndexMap(proofs)

      const { proof: _, ...unsecuredDocument } = securedDocument
      for (const [_index, proof] of proofs.entries()) {
        const matchingProofIndices = this.getMatchingProofIndices(proof, proofIdToIndex)
        const matchingProofs = matchingProofIndices.map((matchingProofIndex) => proofs[matchingProofIndex])
        const singleProofSecuredDocument: W3cDataIntegritySingleProofSecuredDocument = {
          ...unsecuredDocument,
          proof,
        }

        const chainInputDocument = this.reconstructProofInputDocument(unsecuredDocument, matchingProofs)

        const verificationResult = await this.verifySingleProofCore(
          agentContext,
          singleProofSecuredDocument,
          options,
          chainInputDocument
        )
        if (!verificationResult.verified) {
          return verificationResult
        }
      }

      return {
        verified: true,
        verifiedDocument: unsecuredDocument,
        mediaType: null,
      }
    } catch (error) {
      if (!(error instanceof Error)) {
        throw error
      }

      const issue =
        error instanceof W3cDataIntegrityProcessingError
          ? error.issue
          : createIssue(
              W3cDataIntegrityProcessingErrorCode.ProofVerificationError,
              'Error verifying Data Integrity proof set/chain',
              error.message
            )
      return createInvalidResult(issue)
    }
  }

  // ─── Verify (Parsed Document Dispatcher) ──────────────────────────────────

  /**
   * Parses a secured document and dispatches to §4.4 or §4.5 verification paths.
   */
  public async verifyProofDocument(
    agentContext: AgentContext,
    options: W3cDataIntegrityVerifyProofDocumentOptions
  ): Promise<W3cDataIntegrityVerifySuccess | W3cDataIntegrityVerifyFailure> {
    const parseResult = parseW3cDataIntegrityProofDocument(options, this.supportedMediaTypes)
    if (!parseResult.ok) {
      return parseResult.result
    }

    const { normalisedMediaType, securedDocument, verifyOptions } = parseResult.value

    const verificationResult = Array.isArray(securedDocument.proof)
      ? await this.verifyProofSetAndChain(
          agentContext,
          securedDocument as W3cDataIntegrityProofSetSecuredDocument,
          verifyOptions
        )
      : await this.verifyProof(
          agentContext,
          securedDocument as W3cDataIntegritySingleProofSecuredDocument,
          verifyOptions
        )

    if (!verificationResult.verified) {
      return verificationResult
    }

    return {
      ...verificationResult,
      mediaType: normalisedMediaType,
    }
  }

  // ─── Verify (Single Proof Core) ───────────────────────────────────────────

  /**
   * Implements VC Data Integrity v1.0 §4.4 steps 5-8 for a single-proof input.
   * Runs proof policy checks, field-format checks, and cryptosuite verification.
   */
  private async verifySingleProofCore(
    agentContext: AgentContext,
    securedDocument: W3cDataIntegritySingleProofSecuredDocument,
    options: W3cDataIntegrityVerifyProofOptions,
    unsecuredDocument: W3cDataIntegrityUnsecuredDocument = (() => {
      const { proof: _, ...unsecuredDocument } = securedDocument
      return unsecuredDocument
    })()
  ): Promise<W3cDataIntegrityVerifySuccess | W3cDataIntegrityVerifyFailure> {
    const proof = securedDocument.proof

    const proofPolicyIssue = this.validateProofPolicy(proof, options)
    if (proofPolicyIssue) {
      return createInvalidResult(proofPolicyIssue)
    }

    const proofFieldFormatError = validateProofFieldFormats(proof)
    if (proofFieldFormatError) {
      return proofFieldFormatError
    }

    const cryptosuite = this.dataIntegrityCryptosuiteRegistry.createByCryptosuite(agentContext, proof.cryptosuite)
    const proofVerificationInput: W3cDataIntegrityProofVerificationInput = {
      unsecuredDocument,
      proof,
    }
    const verificationResult = await cryptosuite.verifyProof(proofVerificationInput)

    if (!verificationResult.verified || verificationResult.verifiedDocument === null) {
      return createInvalidResult(
        createIssue(W3cDataIntegrityProcessingErrorCode.ProofVerificationError, 'Cryptosuite proof verification failed')
      )
    }

    return {
      verified: true,
      verifiedDocument: verificationResult.verifiedDocument,
      mediaType: null,
    }
  }

  // ─── Verify (Policy Validation) ───────────────────────────────────────────

  /**
   * Implements VC Data Integrity v1.0 §4.4 steps 5-7 verification policy checks.
   * Validates expected proofPurpose, domain, and challenge when provided.
   */
  private validateProofPolicy(
    proof: W3cDataIntegrityCryptosuiteProof,
    options: W3cDataIntegrityVerifyProofOptions
  ): W3cDataIntegrityProcessingIssue | undefined {
    if (options.expectedProofPurpose && proof.proofPurpose !== options.expectedProofPurpose) {
      return createIssue(
        W3cDataIntegrityProcessingErrorCode.ProofVerificationError,
        'Proof purpose does not match expected proof purpose',
        `Expected '${options.expectedProofPurpose}', received '${proof.proofPurpose}'`
      )
    }

    if (options.domain) {
      const expectedDomain = [...new Set(asArray(options.domain))]
      const proofDomain = [...new Set(asArray(proof.domain))]

      if (!equalsIgnoreOrder(expectedDomain, proofDomain)) {
        return createIssue(
          W3cDataIntegrityProcessingErrorCode.InvalidDomainError,
          'Proof domain does not match expected domain'
        )
      }
    }

    if (options.challenge && proof.challenge !== options.challenge) {
      return createIssue(
        W3cDataIntegrityProcessingErrorCode.InvalidChallengeError,
        'Proof challenge does not match expected challenge',
        `Expected '${options.challenge}', received '${proof.challenge ?? 'undefined'}'`
      )
    }

    return undefined
  }

  // ─── Verify (Proof Set Helpers) ───────────────────────────────────────────

  private createProofIdToIndexMap(proofs: W3cDataIntegrityCryptosuiteProof[]) {
    const proofIdToIndex = new Map<string, number>()

    for (const [index, proof] of proofs.entries()) {
      if (typeof proof.id !== 'string') continue
      proofIdToIndex.set(proof.id, index)
    }

    return proofIdToIndex
  }

  private getMatchingProofIndices(proof: W3cDataIntegrityCryptosuiteProof, proofIdToIndex: Map<string, number>) {
    const previousProofReferences = proof.previousProof
      ? Array.isArray(proof.previousProof)
        ? proof.previousProof
        : [proof.previousProof]
      : []

    const matchingProofIndices: number[] = []
    for (const previousProofReference of previousProofReferences) {
      const matchingProofIndex = proofIdToIndex.get(previousProofReference)
      if (matchingProofIndex !== undefined) {
        matchingProofIndices.push(matchingProofIndex)
      }
    }

    return matchingProofIndices
  }

  // ─── Verify (Proof Input Reconstruction) ──────────────────────────────────

  /**
   * Implements VC Data Integrity v1.0 §4.5 step 3.3 input reconstruction.
   * Adds matching dependency proofs into the unsecured document for per-proof verification.
   */
  private reconstructProofInputDocument(
    unsecuredDocument: W3cDataIntegrityUnsecuredDocument,
    matchingProofs: W3cDataIntegrityCryptosuiteProof[]
  ): W3cDataIntegrityUnsecuredDocument {
    if (matchingProofs.length === 0) {
      return unsecuredDocument
    }

    return {
      ...unsecuredDocument,
      proof: matchingProofs.length === 1 ? matchingProofs[0] : matchingProofs,
    }
  }
}
