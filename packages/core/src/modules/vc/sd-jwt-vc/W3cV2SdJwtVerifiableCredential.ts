import { CredoError } from '../../../error'
import { JsonTransformer, MessageValidator } from '../../../utils'
import { ClaimFormat } from '../models/ClaimFormat'
import { W3cV2Credential } from '../models/credential/W3cV2Credential'
import { decodeSdJwt, type W3cV2SdJwt } from './W3cV2SdJwt'

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
    this.resolvedCredential = JsonTransformer.fromJSON(options.sdJwt.prettyClaims, W3cV2Credential, { validate: false })

    // Validates the SD-JWT and resolved credential
    this.validate()
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

  /**
   * Validates the SD-JWT and the resolved credential.
   */
  public validate() {
    // Validate the resolved credential according to the data model
    MessageValidator.validateSync(this.resolvedCredential)

    // Basic JWT validations to ensure compliance to the specification
    const sdJwt = this.sdJwt
    const header = sdJwt.header
    const payload = sdJwt.prettyClaims

    if ('typ' in header && header.typ !== 'vc+sd-jwt') {
      throw new CredoError(`The provided W3C VC SD-JWT does not have the correct 'typ' header.`)
    }

    if ('cyt' in header && header.cyt !== 'vc') {
      throw new CredoError(`The provided W3C VC SD-JWT does not have the correct 'cyt' header.`)
    }

    const iss = header.iss ?? payload.iss
    if (iss) {
      if (this.resolvedCredential.issuerId !== iss) {
        throw new CredoError(`The provided W3C VC SD-JWT has both 'iss' and 'issuer' claims, but they differ.`)
      }
    }

    if (payload.jti) {
      if (this.resolvedCredential.id && this.resolvedCredential.id !== payload.jti) {
        throw new CredoError(`The provided W3C VC JWT has both 'jti' and 'id' claims, but they differ.`)
      }
    }

    if (payload.sub) {
      if (!this.resolvedCredential.credentialSubjectIds.includes(payload.sub as string)) {
        throw new CredoError(
          `The provided W3C VC SD-JWT has a 'sub' claim, but it does not match any credentialSubject.`
        )
      }
    }
  }
}
