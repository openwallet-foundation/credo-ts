import { CredoError } from '../../../error'
import { JsonTransformer, MessageValidator } from '../../../utils'
import { ClaimFormat } from '../models/ClaimFormat'
import { W3cV2Presentation } from '../models/presentation/W3cV2Presentation'

export interface W3cV2DataIntegrityVerifiablePresentationOptions {
  securedPresentation: Record<string, unknown> & { proof: unknown }
}

/**
 * Represents a Verifiable Presentation secured with Data Integrity proof(s).
 *
 * @see https://www.w3.org/TR/vc-data-integrity/
 */
export class W3cV2DataIntegrityVerifiablePresentation {
  public constructor(options: W3cV2DataIntegrityVerifiablePresentationOptions) {
    this.securedPresentation = options.securedPresentation
    this.resolvedPresentation = JsonTransformer.fromJSON(options.securedPresentation, W3cV2Presentation, {
      validate: false,
    })

    // Validates the presentation structure and proof presence
    this.validate()
  }

  public static fromObject(presentation: Record<string, unknown> & { proof: unknown }) {
    return new W3cV2DataIntegrityVerifiablePresentation({
      securedPresentation: presentation,
    })
  }

  /**
   * The original presentation object with embedded Data Integrity proof(s).
   */
  public readonly securedPresentation: Record<string, unknown> & { proof: unknown }

  /**
   * Resolved presentation is the fully resolved {@link W3cV2Presentation} instance.
   */
  public readonly resolvedPresentation: W3cV2Presentation

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
