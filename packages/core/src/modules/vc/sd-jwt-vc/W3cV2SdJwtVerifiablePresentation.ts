import { CredoError } from '../../../error'
import { JsonTransformer, MessageValidator } from '../../../utils'
import { ClaimFormat } from '../models'
import { W3cV2Presentation } from '../models/presentation/W3cV2Presentation'
import { decodeSdJwt, type W3cV2SdJwt } from './W3cV2SdJwt'

export interface W3cV2SdJwtVerifiablePresentationOptions {
  sdJwt: W3cV2SdJwt<ClaimFormat.SdJwtW3cVp>
}

/**
 * Represents a Verifiable Presentation encoded as a SD-JWT.
 *
 * @see https://www.w3.org/TR/vc-jose-cose/#securing-vps-sd-jwt
 */
export class W3cV2SdJwtVerifiablePresentation {
  public constructor(options: W3cV2SdJwtVerifiablePresentationOptions) {
    this.sdJwt = options.sdJwt
    this.resolvedPresentation = JsonTransformer.fromJSON(options.sdJwt.prettyClaims, W3cV2Presentation, {
      validate: false,
    })

    // Validates the SD-JWT and resolved presentation
    this.validate()
  }

  public static fromCompact(compact: string) {
    const sdJwt = decodeSdJwt(compact, ClaimFormat.SdJwtW3cVp)

    return new W3cV2SdJwtVerifiablePresentation({
      sdJwt,
    })
  }

  /**
   * The original SD-JWT.
   */
  public readonly sdJwt: W3cV2SdJwt<ClaimFormat.SdJwtW3cVp>

  /**
   * Resolved presentation is the fully resolved {@link W3cV2Presentation} instance.
   */
  public readonly resolvedPresentation: W3cV2Presentation

  /**
   * The encoded version of this presentation.
   */
  public get encoded() {
    return this.sdJwt.compact
  }

  /**
   * The {@link ClaimFormat} of the presentation.
   *
   * For W3C VP SD-JWT credentials this is always `vp+sd-jwt`.
   */
  public get claimFormat(): ClaimFormat.SdJwtW3cVp {
    return ClaimFormat.SdJwtW3cVp
  }

  /**
   * Validates the SD-JWT and the resolved presentation.
   */
  public validate() {
    // Validate the resolved credential according to the data model
    MessageValidator.validateSync(this.resolvedPresentation)

    // Basic JWT validations to ensure compliance to the specification
    const sdJwt = this.sdJwt
    const header = sdJwt.header
    const payload = sdJwt.prettyClaims

    if ('typ' in header && header.typ !== 'vp+sd-jwt') {
      throw new CredoError(`The provided W3C VP JWT does not have the correct 'typ' header.`)
    }

    if ('cyt' in header && header.cyt !== 'vp') {
      throw new CredoError(`The provided W3C VP JWT does not have the correct 'cyt' header.`)
    }

    const iss = header.iss ?? payload.iss
    if (iss && this.resolvedPresentation.holderId) {
      if (this.resolvedPresentation.holderId !== iss) {
        throw new CredoError(`The provided W3C VP SD-JWT has both 'iss' and 'holder' claims, but they differ.`)
      }
    }
  }
}
