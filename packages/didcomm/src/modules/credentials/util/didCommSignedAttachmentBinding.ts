import { Expose, Type } from 'class-transformer'
import { IsBoolean, IsOptional, IsString, ValidateNested } from 'class-validator'

export interface DidCommSignedAttachmentCreateOfferOptions {
  didMethodsSupported?: string[]
  algsSupported?: string[]
}

/**
 * Options for the holder to create a `didcomm_signed_attachment` binding proof, sent in the request.
 */
export interface DidCommSignedAttachmentCredentialRequestOptions {
  kid: string
  alg?: string
}

export interface DidCommSignedAttachmentOfferBindingMethodOptions {
  algsSupported: string[]
  didMethodsSupported: string[]
  jwkSupported?: boolean
  nonce: string
}

/**
 * The `didcomm_signed_attachment` binding method, as offered by the issuer.
 *
 * This binding method leverages DIDComm signed attachments to bind a credential to a specific key
 * and/or identifier.
 */
export class DidCommSignedAttachmentOfferBindingMethod {
  public constructor(options: DidCommSignedAttachmentOfferBindingMethodOptions) {
    if (options) {
      this.algsSupported = options.algsSupported
      this.didMethodsSupported = options.didMethodsSupported
      this.jwkSupported = options.jwkSupported
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

  // RFC 0881 and RFC 0884. Whether the issuer accepts a signed attachment with a bare key in a `jwk` header.
  @IsOptional()
  @IsBoolean()
  @Expose({ name: 'jwk_supported' })
  public jwkSupported?: boolean

  // Nonce to be used in the request to prevent replay attacks of the signed attachment.
  @IsString()
  public nonce!: string
}

export interface DidCommSignedAttachmentBindingMethodsOptions {
  didcommSignedAttachment?: DidCommSignedAttachmentOfferBindingMethod
}

/**
 * Container of the binding methods supported by the issuer. Each key represents the id of a supported
 * binding method.
 */
export class DidCommSignedAttachmentBindingMethods {
  public constructor(options: DidCommSignedAttachmentBindingMethodsOptions) {
    if (options) {
      this.didcommSignedAttachment = options.didcommSignedAttachment
    }
  }

  @IsOptional()
  @ValidateNested()
  @Type(() => DidCommSignedAttachmentOfferBindingMethod)
  @Expose({ name: 'didcomm_signed_attachment' })
  public didcommSignedAttachment?: DidCommSignedAttachmentOfferBindingMethod
}

export interface DidCommSignedAttachmentBindingProof {
  // The id of the appended attachment included in the request message that contains the signed
  // attachment.
  attachment_id: string
}

export interface DidCommSignedAttachmentCredentialRequestBindingProof {
  didcomm_signed_attachment?: DidCommSignedAttachmentBindingProof
}
