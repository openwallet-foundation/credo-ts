import { CredoError } from '../../../error'
import { JsonTransformer, MessageValidator } from '../../../utils'
import { ClaimFormat } from '../models/ClaimFormat'
import { W3cV2Presentation } from '../models/presentation/W3cV2Presentation'

export interface W3cV2DataIntegrityVerifiablePresentationOptions {
  securedPresentation: Record<string, unknown> & { proof: unknown }
}

/**
 * Stub model for future DI VP support.
 *
 * This class intentionally provides shape compatibility only and does not
 * implement Data Integrity proof verification.
 */
export class W3cV2DataIntegrityVerifiablePresentation {
  public constructor(options: W3cV2DataIntegrityVerifiablePresentationOptions) {
    this.securedPresentation = options.securedPresentation
    this.resolvedPresentation = JsonTransformer.fromJSON(options.securedPresentation, W3cV2Presentation, {
      validate: false,
    })

    this.validate()
  }

  public static fromObject(presentation: Record<string, unknown> & { proof: unknown }) {
    return new W3cV2DataIntegrityVerifiablePresentation({
      securedPresentation: presentation,
    })
  }

  public readonly securedPresentation: Record<string, unknown> & { proof: unknown }
  public readonly resolvedPresentation: W3cV2Presentation

  public get encoded() {
    return JSON.stringify(this.securedPresentation)
  }

  public get claimFormat(): ClaimFormat.DiVp {
    return ClaimFormat.DiVp
  }

  public validate() {
    MessageValidator.validateSync(this.resolvedPresentation)

    const proof = this.securedPresentation.proof
    if (!proof || typeof proof !== 'object') {
      throw new CredoError('The provided Data Integrity presentation must include a proof object or proof array.')
    }
  }
}
