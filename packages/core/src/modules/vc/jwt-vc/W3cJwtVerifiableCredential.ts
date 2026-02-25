import { Jwt } from '../../../crypto/jose/jwt/Jwt'
import { JsonTransformer } from '../../../utils'
import { ClaimFormat } from '../models/ClaimFormat'
import type { W3cCredential } from '../models/credential/W3cCredential'
import type { W3cJsonCredential } from '../models/credential/W3cJsonCredential'

import { getCredentialFromJwtPayload } from './credentialTransformer'

export interface W3cJwtVerifiableCredentialOptions {
  jwt: Jwt
}

export class W3cJwtVerifiableCredential {
  public readonly jwt: Jwt
  private _credential: W3cCredential

  public constructor(options: W3cJwtVerifiableCredentialOptions) {
    this.jwt = options.jwt

    this._credential = getCredentialFromJwtPayload(this.jwt.payload)
  }

  public static fromSerializedJwt(serializedJwt: string) {
    const jwt = Jwt.fromSerializedJwt(serializedJwt)

    return new W3cJwtVerifiableCredential({
      jwt,
    })
  }

  /**
   * Get the W3cCredential from the JWT payload. This does not include the JWT wrapper,
   * and thus is not suitable for sharing. If you need a JWT, use the `serializedJwt` property.
   *
   * All properties and getters from the `W3cCredential` interface are implemented as getters
   * on the `W3cJwtVerifiableCredential` class itself, so you can also use this directly
   * instead of accessing the inner `credential` property.
   */
  public get credential(): W3cCredential {
    return this._credential
  }

  public get serializedJwt(): string {
    return this.jwt.serializedJwt
  }

  //
  // Below all properties from the `W3cCredential` interface are implemented as getters
  // this is to make the interface compatible with the W3cJsonLdVerifiableCredential interface
  // which makes using the different classes interchangeably from a user point of view.
  // This is 'easier' than extending the W3cCredential class as it means we have to create the
  // instance based on JSON, but also add custom properties.
  //

  public get context() {
    return this.credential.context
  }

  public get id() {
    return this.credential.id
  }

  public get type() {
    return this.credential.type
  }

  public get issuer() {
    return this.credential.issuer
  }

  public get issuanceDate() {
    return this.credential.issuanceDate
  }

  public get expirationDate() {
    return this.credential.expirationDate
  }

  public get credentialSubject() {
    return this.credential.credentialSubject
  }

  public get credentialSchema() {
    return this.credential.credentialSchema
  }

  public get credentialStatus() {
    return this.credential.credentialStatus
  }

  public get issuerId() {
    return this.credential.issuerId
  }

  public get credentialSchemaIds() {
    return this.credential.credentialSchemaIds
  }

  public get credentialSubjectIds() {
    return this.credential.credentialSubjectIds
  }

  public get contexts() {
    return this.credential.contexts
  }

  /**
   * The {@link ClaimFormat} of the credential. For JWT credentials this is always `jwt_vc`.
   */
  public get claimFormat(): ClaimFormat.JwtVc {
    return ClaimFormat.JwtVc
  }

  /**
   * Get the encoded variant of the W3C Verifiable Credential. For JWT credentials this is
   * a JWT string.
   */
  public get encoded() {
    return this.serializedJwt
  }

  public get jsonCredential(): W3cJsonCredential {
    return JsonTransformer.toJSON(this.credential) as W3cJsonCredential
  }
}
