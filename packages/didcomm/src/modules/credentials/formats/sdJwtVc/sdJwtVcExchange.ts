import type { ClaimPath, SdJwtVcPayload } from '@credo-ts/core'
import { Expose, Type } from 'class-transformer'
import { IsArray, IsBoolean, IsObject, IsOptional, ValidateNested } from 'class-validator'
import {
  DidCommSignedAttachmentBindingMethods,
  type DidCommSignedAttachmentCredentialRequestBindingProof,
} from '../../util/didCommSignedAttachmentBinding'

export interface SdJwtVcCredentialOfferOptions {
  bindingRequired?: boolean
  bindingMethod?: DidCommSignedAttachmentBindingMethods
  selectivelyDisclosableClaims?: ClaimPath[]
  credential: SdJwtVcPayload
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
  public credential!: SdJwtVcPayload
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
