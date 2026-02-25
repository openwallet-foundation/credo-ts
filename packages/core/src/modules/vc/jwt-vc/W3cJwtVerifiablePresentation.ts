import { Jwt } from '../../../crypto/jose/jwt/Jwt'
import { CredoError } from '../../../error'
import type { W3cPresentation } from '../models'
import { ClaimFormat } from '../models'

import { getPresentationFromJwtPayload } from './presentationTransformer'

export interface W3cJwtVerifiablePresentationOptions {
  jwt: Jwt
}

export class W3cJwtVerifiablePresentation {
  public readonly jwt: Jwt
  private _presentation: W3cPresentation

  public constructor(options: W3cJwtVerifiablePresentationOptions) {
    this.jwt = options.jwt

    this._presentation = getPresentationFromJwtPayload(this.jwt.payload)
  }

  public static fromSerializedJwt(serializedJwt: string) {
    const jwt = Jwt.fromSerializedJwt(serializedJwt)

    if (!jwt.payload.additionalClaims.nonce) {
      throw new CredoError(`JWT payload does not contain required claim 'nonce'`)
    }

    return new W3cJwtVerifiablePresentation({
      jwt,
    })
  }

  /**
   * Get the W3cPresentation from the JWT payload. This does not include the JWT wrapper,
   * and thus is not suitable for sharing. If you need a JWT, use the `serializedJwt` property.
   *
   * All properties and getters from the `W3cPresentation` interface are implemented as getters
   * on the `W3cJwtVerifiablePresentation` class itself, so you can also use this directly
   * instead of accessing the inner `presentation` property.
   */
  public get presentation(): W3cPresentation {
    return this._presentation
  }

  public get serializedJwt(): string {
    return this.jwt.serializedJwt
  }

  //
  // Below all properties from the `W3cPresentation` interface are implemented as getters
  // this is to make the interface compatible with the W3cJsonLdVerifiablePresentation interface
  // which makes using the different classes interchangeably from a user point of view.
  // This is 'easier' than extending the W3cPresentation class as it means we have to create the
  // instance based on JSON, but also add custom properties.
  //

  public get context() {
    return this.presentation.context
  }

  public get id() {
    return this.presentation.id
  }

  public get type() {
    return this.presentation.type
  }

  public get holder() {
    return this.presentation.holder
  }

  public get verifiableCredential() {
    return this.presentation.verifiableCredential
  }

  public get holderId() {
    return this.presentation.holderId
  }

  /**
   * The {@link ClaimFormat} of the presentation. For JWT presentations this is always `jwt_vp`.
   */
  public get claimFormat(): ClaimFormat.JwtVp {
    return ClaimFormat.JwtVp
  }

  /**
   * Get the encoded variant of the W3C Verifiable Presentation. For JWT presentations this is
   * a JWT string.
   */
  public get encoded() {
    return this.serializedJwt
  }
}
