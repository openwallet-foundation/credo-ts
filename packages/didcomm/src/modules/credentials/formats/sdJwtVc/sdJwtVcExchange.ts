import type { ClaimPath, JsonObject, SdJwtVcPayload } from '@credo-ts/core'
import { Expose, Type } from 'class-transformer'
import { IsArray, IsBoolean, IsObject, IsOptional, ValidateNested } from 'class-validator'
import {
  DidCommSignedAttachmentBindingMethods,
  type DidCommSignedAttachmentCredentialRequestBindingProof,
} from '../../util/didCommSignedAttachmentBinding'

// `Omit` would drop the named claims, as `SdJwtVcPayload` has an index signature
export type SdJwtVcCredentialOfferPayload = Pick<
  SdJwtVcPayload,
  'iss' | 'nbf' | 'exp' | 'aud' | 'jti' | 'cnf' | 'vct' | 'vct#integrity' | 'sub' | 'iat'
> &
  Record<string, unknown> & {
    /** A status mechanism can omit its members, as in `{ status_list: {} }`, for the issuer to set them in `acceptRequest`. */
    status?: SdJwtVcPayload['status'] | Record<string, JsonObject>
  }

export interface SdJwtVcCredentialOfferOptions {
  bindingRequired?: boolean
  bindingMethod?: DidCommSignedAttachmentBindingMethods
  selectivelyDisclosableClaims?: ClaimPath[]
  credential: SdJwtVcCredentialOfferPayload
}

/**
 * The `didcomm/dc-sd-jwt-offer@v1.0` attachment format of Aries RFC 0884.
 */
export class SdJwtVcCredentialOffer {
  public constructor(options: SdJwtVcCredentialOfferOptions) {
    if (options) {
      this.bindingRequired = options.bindingRequired
      this.bindingMethod = options.bindingMethod
      this.selectivelyDisclosableClaims = options.selectivelyDisclosableClaims
      this.credential = options.credential
    }
  }

  @IsOptional()
  @IsBoolean()
  @Expose({ name: 'binding_required' })
  public bindingRequired?: boolean

  @IsOptional()
  @ValidateNested()
  @Type(() => DidCommSignedAttachmentBindingMethods)
  @Expose({ name: 'binding_method' })
  public bindingMethod?: DidCommSignedAttachmentBindingMethods

  @IsOptional()
  @IsArray()
  @Expose({ name: 'selectively_disclosable_claims' })
  public selectivelyDisclosableClaims?: ClaimPath[]

  @IsObject()
  @Expose({ name: 'credential' })
  public credential!: SdJwtVcCredentialOfferPayload
}

/**
 * The `didcomm/dc-sd-jwt-request@v1.0` attachment format of Aries RFC 0884.
 */
export interface SdJwtVcCredentialRequest {
  binding_proof?: DidCommSignedAttachmentCredentialRequestBindingProof
}

/**
 * The `didcomm/dc-sd-jwt@v1.0` attachment format of Aries RFC 0884.
 */
export interface SdJwtVcCredential {
  credential: string
}
