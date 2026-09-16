import { type JsonObject, JsonTransformer, W3cV2Credential } from '@credo-ts/core'
import { Expose, Type } from 'class-transformer'
import { IsBoolean, IsOptional, IsString, ValidateNested } from 'class-validator'

export interface W3cV2SdJwtDidCommSignedAttachmentBindingMethodOptions {
  algsSupported: string[]
  didMethodsSupported: string[]
  nonce: string
}

/**
 * The `didcomm_signed_attachment` binding method, as offered by the issuer.
 *
 * This binding method leverages DIDComm signed attachments to bind a credential to a specific key
 * and/or identifier.
 */
export class W3cV2SdJwtDidCommSignedAttachmentBindingMethod {
  public constructor(options: W3cV2SdJwtDidCommSignedAttachmentBindingMethodOptions) {
    if (options) {
      this.algsSupported = options.algsSupported
      this.didMethodsSupported = options.didMethodsSupported
      this.nonce = options.nonce
    }
  }

  // List of strings indicating the JSON Web Algorithms supported by the issuer for verifying the
  // signed attachment. The list MUST contain at least one value. The values MUST be a valid algorithm
  // identifier as defined in the JSON Web Signature and Encryption Algorithms registry.
  @IsString({ each: true })
  @Expose({ name: 'algs_supported' })
  public algsSupported!: string[]

  // List of strings indicating which DID methods are supported by the issuer for binding the
  // credential to the holder. The list MUST contain at least one value. Values should ONLY include the
  // method identifier of the DID method (e.g. `key`, `jwk`, `web`).
  @IsString({ each: true })
  @Expose({ name: 'did_methods_supported' })
  public didMethodsSupported!: string[]

  // Nonce to be used in the request to prevent replay attacks of the signed attachment.
  @IsString()
  public nonce!: string
}

export interface W3cV2SdJwtBindingMethodsOptions {
  didcommSignedAttachment?: W3cV2SdJwtDidCommSignedAttachmentBindingMethod
}

/**
 * Container of the binding methods supported by the issuer. Each key represents the id of a supported
 * binding method.
 */
export class W3cV2SdJwtBindingMethods {
  public constructor(options: W3cV2SdJwtBindingMethodsOptions) {
    if (options) {
      this.didcommSignedAttachment = options.didcommSignedAttachment
    }
  }

  @IsOptional()
  @ValidateNested()
  @Type(() => W3cV2SdJwtDidCommSignedAttachmentBindingMethod)
  @Expose({ name: 'didcomm_signed_attachment' })
  public didcommSignedAttachment?: W3cV2SdJwtDidCommSignedAttachmentBindingMethod
}

export interface W3cV2SdJwtCredentialOfferOptions {
  bindingRequired?: boolean
  bindingMethod?: W3cV2SdJwtBindingMethods
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
  @Type(() => W3cV2SdJwtBindingMethods)
  @Expose({ name: 'binding_method' })
  public bindingMethod?: W3cV2SdJwtBindingMethods

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

export interface W3cV2SdJwtDidCommSignedAttachmentBindingProof {
  // The id of the appended attachment included in the request message that contains the signed
  // attachment.
  attachment_id: string
}

export interface W3cV2SdJwtCredentialRequestBindingProof {
  didcomm_signed_attachment?: W3cV2SdJwtDidCommSignedAttachmentBindingProof
}

/**
 * The `didcomm/w3c-vc-sd-jwt-request@v1.0` attachment format, used to request issuance of a credential.
 */
export interface W3cV2SdJwtCredentialRequest {
  // Required if binding_required is true in the offer.
  // Object containing key-value pairs of proofs for the binding to the holder.
  // The keys MUST match keys of the binding_method object from the offer.
  binding_proof?: W3cV2SdJwtCredentialRequestBindingProof
}

/**
 * The `didcomm/w3c-vc-sd-jwt@v1.0` attachment format, used to transmit a verifiable credential with
 * SD-JWT securing mechanism.
 */
export interface W3cV2SdJwtCredential {
  // The SD-JWT in compact serialization format. The credential MUST conform to the VC Data Model 2.0
  // and use the `application/w3c-vc-sd-jwt` media type as defined in W3C VC-JOSE-COSE.
  credential: string
}
