import { CredoError } from '../../../error'
import { ClaimFormat } from '../models/ClaimFormat'
import { W3cV2Credential, W3cV2CredentialOptions } from '../models/credential/W3cV2Credential'
import { W3cV2SdJwt, decodeSdJwt } from './W3cV2SdJwt'

const MIMETYPE_VC_SD_JWT = 'application/vc+sd-jwt'

export interface W3cV2SdJwtVerifiableCredentialOptions {
  sdJwt: W3cV2SdJwt<ClaimFormat.SdJwtW3cVc>
}

export class W3cV2SdJwtVerifiableCredential {
  public readonly sdJwt: W3cV2SdJwt<ClaimFormat.SdJwtW3cVc>
  public readonly credential: W3cV2Credential

  public constructor(options: W3cV2SdJwtVerifiableCredentialOptions) {
    this.sdJwt = options.sdJwt
    this.credential = new W3cV2Credential(options.sdJwt.prettyClaims as W3cV2CredentialOptions)
  }

  public static fromCompact(compact: string) {
    const sdJwt = decodeSdJwt(compact, ClaimFormat.SdJwtW3cVc)

    return new W3cV2SdJwtVerifiableCredential({
      sdJwt,
    })
  }

  public static fromDataUri(uri: string) {
    const prefix = `data:${MIMETYPE_VC_SD_JWT},`
    if (!uri.startsWith(prefix)) {
      throw new CredoError(`The provided string is not a valid ${MIMETYPE_VC_SD_JWT} data URI: "${uri}".`)
    }

    const compact = uri.slice(prefix.length)
    return W3cV2SdJwtVerifiableCredential.fromCompact(compact)
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
   * For W3C VC SD-JWT credentials this is always `vc+sd-jwt`.
   */
  public get claimFormat(): ClaimFormat.SdJwtW3cVc {
    return ClaimFormat.SdJwtW3cVc
  }

  /**
   * The data URI representation of this W3C VC SD-JWT credential.
   */
  public get dataUri(): string {
    return `data:${MIMETYPE_VC_SD_JWT},${this.compact}`
  }
}
