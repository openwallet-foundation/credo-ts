import { Jwt } from '../../../crypto/jose/jwt/Jwt'
import { CredoError } from '../../../error'
import { JsonTransformer, MessageValidator } from '../../../utils'
import { ClaimFormat } from '../models/ClaimFormat'
import { W3cV2Credential } from '../models/credential/W3cV2Credential'

export interface W3cV2JwtVerifiableCredentialOptions {
  jwt: Jwt
}

/**
 * Represents a Verifiable Credential encoded as a JWT.
 *
 * @see https://www.w3.org/TR/vc-jose-cose/#securing-with-jose
 */
export class W3cV2JwtVerifiableCredential {
  public constructor(options: W3cV2JwtVerifiableCredentialOptions) {
    this.jwt = options.jwt
    this.resolvedCredential = JsonTransformer.fromJSON(options.jwt.payload.additionalClaims, W3cV2Credential, {
      validate: false,
    })

    // Validates the JWT and resolved credential
    this.validate()
  }

  public static fromCompact(compact: string) {
    const jwt = Jwt.fromSerializedJwt(compact)

    return new W3cV2JwtVerifiableCredential({
      jwt,
    })
  }

  /**
   * The original JWT.
   */
  public readonly jwt: Jwt

  /**
   * Resolved credential is the fully resolved {@link W3cV2Credential} instance.
   */
  public readonly resolvedCredential: W3cV2Credential

  /**
   * The encoded version of this credential.
   */
  public get encoded() {
    return this.jwt.serializedJwt
  }

  /**
   * The {@link ClaimFormat} of the credential.
   *
   * For W3C VC JWT credentials this is always `vc+jwt`.
   */
  public get claimFormat(): ClaimFormat.JwtW3cVc {
    return ClaimFormat.JwtW3cVc
  }

  /**
   * Validates the JWT and the resolved credential contained.
   */
  public validate() {
    // Validate the resolved credential according to the data model
    MessageValidator.validateSync(this.resolvedCredential)

    // JWT validations to ensure compliance to the specification
    const jwt = this.jwt
    const header = jwt.header
    const payload = jwt.payload

    if (header.alg === 'none') {
      throw new CredoError(`The provided W3C VC JWT uses 'alg'='none', which is not allowed.`)
    }

    if ('typ' in header && header.typ !== 'vc+jwt') {
      throw new CredoError(`The provided W3C VC JWT does not have the correct 'typ' header.`)
    }

    if ('cty' in header && header.cty !== 'vc') {
      throw new CredoError(`The provided W3C VC JWT does not have the correct 'cty' header.`)
    }

    if (payload.iss) {
      if (this.resolvedCredential.issuerId !== payload.iss) {
        throw new CredoError(`The provided W3C VC JWT has both 'iss' and 'issuer' claims, but they differ.`)
      }
    }
  }
}
