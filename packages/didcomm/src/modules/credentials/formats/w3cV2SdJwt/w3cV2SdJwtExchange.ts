import { type JsonObject, JsonTransformer, W3cV2Credential } from '@credo-ts/core'
import { Expose, Type } from 'class-transformer'
import { IsBoolean, IsOptional, IsString, ValidateNested } from 'class-validator'
import {
  DidCommSignedAttachmentBindingMethods,
  type DidCommSignedAttachmentBindingMethodsOptions,
  type DidCommSignedAttachmentBindingProof,
  type DidCommSignedAttachmentCredentialRequestBindingProof,
  DidCommSignedAttachmentOfferBindingMethod,
  type DidCommSignedAttachmentOfferBindingMethodOptions,
} from '../../util/didCommSignedAttachmentBinding'

/** @deprecated Use `DidCommSignedAttachmentOfferBindingMethodOptions` */
export type W3cV2SdJwtDidCommSignedAttachmentBindingMethodOptions = DidCommSignedAttachmentOfferBindingMethodOptions

/** @deprecated Use `DidCommSignedAttachmentOfferBindingMethod` */
export const W3cV2SdJwtDidCommSignedAttachmentBindingMethod = DidCommSignedAttachmentOfferBindingMethod
/** @deprecated Use `DidCommSignedAttachmentOfferBindingMethod` */
export type W3cV2SdJwtDidCommSignedAttachmentBindingMethod = DidCommSignedAttachmentOfferBindingMethod

/** @deprecated Use `DidCommSignedAttachmentBindingMethodsOptions` */
export type W3cV2SdJwtBindingMethodsOptions = DidCommSignedAttachmentBindingMethodsOptions

/** @deprecated Use `DidCommSignedAttachmentBindingMethods` */
export const W3cV2SdJwtBindingMethods = DidCommSignedAttachmentBindingMethods
/** @deprecated Use `DidCommSignedAttachmentBindingMethods` */
export type W3cV2SdJwtBindingMethods = DidCommSignedAttachmentBindingMethods

export interface W3cV2SdJwtCredentialOfferOptions {
  bindingRequired?: boolean
  bindingMethod?: DidCommSignedAttachmentBindingMethods
  selectivelyDisclosableClaims?: string[]
  credential: W3cV2Credential | JsonObject
}

/**
 * The `didcomm/w3c-vc-sd-jwt-offer@v1.0` attachment format, used to offer a credential to a potential
 * holder.
 */
export class W3cV2SdJwtCredentialOffer {
  public constructor(options: W3cV2SdJwtCredentialOfferOptions) {
    if (options) {
      this.bindingRequired = options.bindingRequired
      this.bindingMethod = options.bindingMethod
      this.selectivelyDisclosableClaims = options.selectivelyDisclosableClaims
      this.credential =
        options.credential instanceof W3cV2Credential ? JsonTransformer.toJSON(options.credential) : options.credential
    }
  }

  // Boolean indicating whether the credential MUST be bound to the holder. If omitted, the credential
  // is not required to be bound to the holder. If set to true, the credential MUST be bound to the
  // holder using at least one of the binding methods defined in binding_method.
  @IsOptional()
  @IsBoolean()
  @Expose({ name: 'binding_required' })
  public bindingRequired?: boolean

  // Required if binding_required is true.
  // Object containing key-value pairs of binding methods supported by the issuer to bind the
  // credential to a holder.
  @IsOptional()
  @ValidateNested()
  @Type(() => DidCommSignedAttachmentBindingMethods)
  @Expose({ name: 'binding_method' })
  public bindingMethod?: DidCommSignedAttachmentBindingMethods

  // Array of strings indicating which claims in the issued credential will be selectively disclosable.
  // Each string is a JSONPath expression that points to a single, unambiguous location within the
  // credential object (e.g. `$.credentialSubject.degree.name`). Only dot-notation member accessors and
  // array indices are permitted. If omitted, the issuer does not communicate which claims will be
  // selectively disclosable ahead of issuance.
  @IsOptional()
  @IsString({ each: true })
  @Expose({ name: 'selectively_disclosable_claims' })
  public selectivelyDisclosableClaims?: string[]

  // The credential to be issued. The credential MUST conform to VC Data Model 2.0 and MUST NOT contain
  // any proofs. Some properties MAY be omitted if they will only be available at time of issuance,
  // such as validFrom, issuer, credentialSubject.id and credentialStatus.
  @Expose({ name: 'credential' })
  public credential!: JsonObject
}

/** @deprecated Use `DidCommSignedAttachmentBindingProof` */
export type W3cV2SdJwtDidCommSignedAttachmentBindingProof = DidCommSignedAttachmentBindingProof

/** @deprecated Use `DidCommSignedAttachmentCredentialRequestBindingProof` */
export type W3cV2SdJwtCredentialRequestBindingProof = DidCommSignedAttachmentCredentialRequestBindingProof

/**
 * The `didcomm/w3c-vc-sd-jwt-request@v1.0` attachment format, used to request issuance of a credential.
 */
export interface W3cV2SdJwtCredentialRequest {
  // Required if binding_required is true in the offer.
  // Object containing key-value pairs of proofs for the binding to the holder.
  // The keys MUST match keys of the binding_method object from the offer.
  binding_proof?: DidCommSignedAttachmentCredentialRequestBindingProof
}

/**
 * The `didcomm/w3c-vc-sd-jwt@v1.0` attachment format, used to transmit a verifiable credential with
 * SD-JWT securing mechanism.
 */
export interface W3cV2SdJwtCredential {
  // The SD-JWT in compact serialization format. The credential MUST conform to the VC Data Model 2.0
  // and use the `application/vc+sd-jwt` media type as defined in W3C VC-JOSE-COSE.
  credential: string
}
