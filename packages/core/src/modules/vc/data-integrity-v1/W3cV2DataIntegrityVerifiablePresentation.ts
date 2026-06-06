import { CredoError } from '../../../error'
import type { JsonObject, SingleOrArray } from '../../../types'
import { MessageValidator } from '../../../utils'
import { ClaimFormat } from '../models/ClaimFormat'
import { W3cV2DataIntegrityVerifiableCredential } from './W3cV2DataIntegrityVerifiableCredential'

export type W3cV2DataIntegritySecuredPresentation = Record<string, unknown> & { proof: unknown }

type W3cV2DataIntegrityPresentationCredentialObjectEntry = {
  id?: string
  type?: SingleOrArray<string>
  proof?: unknown
  verifiableCredential?: SingleOrArray<W3cV2DataIntegrityPresentationCredentialEntry>
}

export type W3cV2DataIntegrityPresentationCredentialEntry =
  | W3cV2DataIntegrityVerifiableCredential
  | W3cV2DataIntegrityVerifiablePresentation
  | W3cV2DataIntegrityPresentationCredentialObjectEntry
  | string

export type W3cV2DataIntegrityResolvedPresentation = {
  context?: Array<string | JsonObject>
  type?: SingleOrArray<string>
  holder?: string | { id: string; [property: string]: unknown }
  holderId?: string
  verifiableCredential?: SingleOrArray<W3cV2DataIntegrityPresentationCredentialEntry>
}

export interface W3cV2DataIntegrityVerifiablePresentationOptions {
  securedPresentation: W3cV2DataIntegritySecuredPresentation
  resolvedPresentation: W3cV2DataIntegrityResolvedPresentation
}

/**
 * Represents a Verifiable Presentation secured with Data Integrity proof(s).
 *
 * @see https://www.w3.org/TR/vc-data-integrity/
 */
export class W3cV2DataIntegrityVerifiablePresentation {
  public constructor(options: W3cV2DataIntegrityVerifiablePresentationOptions) {
    this.securedPresentation = options.securedPresentation
    this.resolvedPresentation = options.resolvedPresentation

    // Validates the presentation structure and proof presence
    this.validate()
  }

  public static fromObject(
    presentation: W3cV2DataIntegritySecuredPresentation,
    resolvedPresentation: W3cV2DataIntegrityResolvedPresentation
  ) {
    return new W3cV2DataIntegrityVerifiablePresentation({
      securedPresentation: presentation,
      resolvedPresentation,
    })
  }

  /**
   * The original presentation object with embedded Data Integrity proof(s).
   */
  public readonly securedPresentation: W3cV2DataIntegritySecuredPresentation

  /**
   * Resolved presentation is the parsed VP object used for traversal and validation.
   */
  public readonly resolvedPresentation: W3cV2DataIntegrityResolvedPresentation

  /**
   * The JSON representation of this presentation.
   */
  public get encoded() {
    return JSON.stringify(this.securedPresentation)
  }

  /**
   * The {@link ClaimFormat} of the presentation.
   *
   * For W3C VP Data Integrity presentations this is always `di_vp`.
   */
  public get claimFormat(): ClaimFormat.DiVp {
    return ClaimFormat.DiVp
  }

  /**
   * Validates the presentation and proof structure.
   */
  public validate() {
    // Validate the resolved presentation according to the data model
    MessageValidator.validateSync(this.resolvedPresentation)

    // Validate that proof field exists and is properly structured
    const proof = this.securedPresentation.proof
    if (!proof) {
      throw new CredoError('The provided presentation does not have a proof field.')
    }

    // Proof should be either a single proof object or an array of proofs
    if (typeof proof !== 'object') {
      throw new CredoError('The proof field must be an object or array of objects.')
    }

    if (
      !Array.isArray(proof) &&
      typeof proof === 'object' &&
      (!('type' in proof) || proof.type !== 'DataIntegrityProof')
    ) {
      throw new CredoError('The proof must have type "DataIntegrityProof".')
    }

    if (Array.isArray(proof)) {
      for (const p of proof) {
        if (typeof p !== 'object' || !('type' in p) || p.type !== 'DataIntegrityProof') {
          throw new CredoError('All proofs in the proof array must have type "DataIntegrityProof".')
        }
      }
    }
  }
}
