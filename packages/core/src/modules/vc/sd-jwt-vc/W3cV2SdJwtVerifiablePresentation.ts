import { CredoError } from '../../../error'
import { JsonTransformer } from '../../../utils'
import { ClaimFormat } from '../models'
import { W3cV2Presentation } from '../models/presentation/W3cV2Presentation'
import { W3cV2SdJwt, decodeSdJwt } from './W3cV2SdJwt'

const MIMETYPE_VP_SD_JWT = 'application/vp+sd-jwt'

export interface W3cV2SdJwtVerifiablePresentationOptions {
  sdJwt: W3cV2SdJwt<ClaimFormat.SdJwtW3cVp>
}

export class W3cV2SdJwtVerifiablePresentation {
  public readonly sdJwt: W3cV2SdJwt<ClaimFormat.SdJwtW3cVp>
  public readonly presentation: W3cV2Presentation

  public constructor(options: W3cV2SdJwtVerifiablePresentationOptions) {
    this.sdJwt = options.sdJwt
    this.presentation = JsonTransformer.fromJSON(options.sdJwt.prettyClaims, W3cV2Presentation)
  }

  public static fromCompact(compact: string) {
    const sdJwt = decodeSdJwt(compact, ClaimFormat.SdJwtW3cVp)

    return new W3cV2SdJwtVerifiablePresentation({
      sdJwt,
    })
  }

  public static fromDataUri(uri: string) {
    const prefix = `data:${MIMETYPE_VP_SD_JWT},`
    if (!uri.startsWith(prefix)) {
      throw new CredoError(`The provided string is not a valid ${MIMETYPE_VP_SD_JWT} data URI: "${uri}".`)
    }

    const compact = uri.slice(prefix.length)
    return W3cV2SdJwtVerifiablePresentation.fromCompact(compact)
  }

  /**
   * The compact serialization of this credential.
   */
  public get compact() {
    return this.sdJwt.compact
  }

  /**
   * The {@link ClaimFormat} of the credential.
   *
   * For W3C VP SD-JWT credentials this is always `vp+sd-jwt`.
   */
  public get claimFormat(): ClaimFormat.SdJwtW3cVp {
    return ClaimFormat.SdJwtW3cVp
  }

  /**
   * The data URI representation of this W3C VP SD-JWT credential.
   */
  public get dataUri(): string {
    return `data:${MIMETYPE_VP_SD_JWT},${this.compact}`
  }
}
