import { JsonTransformer } from '../../../utils'
import { ClaimFormat } from '../models/ClaimFormat'
import { W3cV2Credential } from '../models/credential/W3cV2Credential'
import { W3cV2SdJwt, decodeSdJwt } from './W3cV2SdJwt'

export interface W3cV2SdJwtVerifiableCredentialOptions {
  sdJwt: W3cV2SdJwt<ClaimFormat.SdJwtW3cVc>
}

/**
 * Represents a Verifiable Credential encoded as a SD-JWT.
 *
 * @see https://www.w3.org/TR/vc-jose-cose/#securing-with-sd-jwt
 */
export class W3cV2SdJwtVerifiableCredential {
  public constructor(options: W3cV2SdJwtVerifiableCredentialOptions) {
    this.sdJwt = options.sdJwt
    this.resolvedCredential = JsonTransformer.fromJSON(options.sdJwt.prettyClaims, W3cV2Credential)
  }

  public static fromCompact(compact: string) {
    const sdJwt = decodeSdJwt(compact, ClaimFormat.SdJwtW3cVc)

    return new W3cV2SdJwtVerifiableCredential({
      sdJwt,
    })
  }

  /**
   * The original SD-JWT.
   */
  public readonly sdJwt: W3cV2SdJwt<ClaimFormat.SdJwtW3cVc>

  /**
   * Resolved credential is the fully resolved {@link W3cV2Credential} instance.
   */
  public readonly resolvedCredential: W3cV2Credential

  /**
   * The encoded version of this credential.
   */
  public get encoded() {
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
}
