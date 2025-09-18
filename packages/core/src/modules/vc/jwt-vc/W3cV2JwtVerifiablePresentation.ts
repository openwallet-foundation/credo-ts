import { Jwt } from '../../../crypto/jose/jwt/Jwt'
import { CredoError } from '../../../error'
import { JsonTransformer, MessageValidator } from '../../../utils'
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
    this.resolvedPresentation = JsonTransformer.fromJSON(options.jwt.payload.additionalClaims, W3cV2Presentation, {
      validate: false,
    })

    // Validates the JWT and resolved presentation
    this.validate()
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

  /**
   * Validates the JWT and the resolved presentation.
   */
  public validate() {
    // Validate the resolved credential according to the data model
    MessageValidator.validateSync(this.resolvedPresentation)

    // Basic JWT validations to ensure compliance to the specification
    const jwt = this.jwt
    const header = jwt.header
    const payload = jwt.payload

    if ('typ' in header && header.typ !== 'vp+jwt') {
      throw new CredoError(`The provided W3C VP JWT does not have the correct 'typ' header.`)
    }

    if ('cyt' in header && header.cyt !== 'vp') {
      throw new CredoError(`The provided W3C VP JWT does not have the correct 'cyt' header.`)
    }

    const iss = header.iss ?? payload.iss
    if (iss && this.resolvedPresentation.holderId) {
      if (this.resolvedPresentation.holderId !== iss) {
        throw new CredoError(`The provided W3C VP JWT has both 'iss' and 'holder' claims, but they differ.`)
      }
    }
  }
}
