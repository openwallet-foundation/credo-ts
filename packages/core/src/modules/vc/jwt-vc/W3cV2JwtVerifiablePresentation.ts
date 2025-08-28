import { Jwt } from '../../../crypto/jose/jwt/Jwt'
import { JsonTransformer } from '../../../utils'
import { ClaimFormat } from '../models'
import { W3cV2Presentation } from '../models/presentation/W3cV2Presentation'

export interface W3cV2JwtVerifiablePresentationOptions {
  jwt: Jwt
}

/**
 * Represents a Verifiable Presentation encoded as a JWT.
 *
 * @see https://www.w3.org/TR/vc-jose-cose/#securing-vps-with-jose
 */
export class W3cV2JwtVerifiablePresentation {
  public constructor(options: W3cV2JwtVerifiablePresentationOptions) {
    this.jwt = options.jwt
    this.resolvedPresentation = JsonTransformer.fromJSON(options.jwt.payload.additionalClaims, W3cV2Presentation)
  }

  public static fromCompact(compact: string) {
    const jwt = Jwt.fromSerializedJwt(compact)

    return new W3cV2JwtVerifiablePresentation({
      jwt,
    })
  }

  /**
   * The original JWT.
   */
  public readonly jwt: Jwt

  /**
   * Resolved presentation is the fully resolved {@link W3cV2Presentation} instance.
   */
  public readonly resolvedPresentation: W3cV2Presentation

  /**
   * The encoded version of this presentation.
   */
  public get encoded() {
    return this.jwt.serializedJwt
  }

  /**
   * The {@link ClaimFormat} of the presentation.
   *
   * For W3C VP JWT credentials this is always `vp+jwt`.
   */
  public get claimFormat(): ClaimFormat.JwtW3cVp {
    return ClaimFormat.JwtW3cVp
  }
}
