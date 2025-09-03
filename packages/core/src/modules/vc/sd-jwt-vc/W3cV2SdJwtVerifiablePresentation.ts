import { JsonTransformer } from '../../../utils'
import { ClaimFormat } from '../models'
import { W3cV2Presentation } from '../models/presentation/W3cV2Presentation'
import { W3cV2SdJwt, decodeSdJwt } from './W3cV2SdJwt'

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
    this.resolvedPresentation = JsonTransformer.fromJSON(options.sdJwt.prettyClaims, W3cV2Presentation)
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
}
