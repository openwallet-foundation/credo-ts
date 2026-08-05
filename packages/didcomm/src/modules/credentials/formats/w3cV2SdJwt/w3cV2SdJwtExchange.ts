import type { JsonObject } from "@credo-ts/core";
import { Expose, Type } from "class-transformer";
import {
  IsBoolean,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";

export interface W3cV2SdJwtDidCommSignedAttachmentBindingMethodOptions {
  algsSupported: string[];
  didMethodsSupported: string[];
  nonce: string;
}

export class W3cV2SdJwtDidCommSignedAttachmentBindingMethod {
  public constructor(
    options: W3cV2SdJwtDidCommSignedAttachmentBindingMethodOptions,
  ) {
    if (options) {
      this.algsSupported = options.algsSupported;
      this.didMethodsSupported = options.didMethodsSupported;
      this.nonce = options.nonce;
    }
  }

  @IsString({ each: true })
  @Expose({ name: "algs_supported" })
  public algsSupported!: string[];

  @IsString({ each: true })
  @Expose({ name: "did_methods_supported" })
  public didMethodsSupported!: string[];

  @IsString()
  public nonce!: string;
}

export interface W3cV2SdJwtBindingMethodOptions {
  didcommSignedAttachment?: W3cV2SdJwtDidCommSignedAttachmentBindingMethod;
}

export class W3cV2SdJwtBindingMethod {
  public constructor(options: W3cV2SdJwtBindingMethodOptions) {
    if (options) {
      this.didcommSignedAttachment = options.didcommSignedAttachment;
    }
  }

  @IsOptional()
  @ValidateNested()
  @Type(() => W3cV2SdJwtDidCommSignedAttachmentBindingMethod)
  @Expose({ name: "didcomm_signed_attachment" })
  public didcommSignedAttachment?: W3cV2SdJwtDidCommSignedAttachmentBindingMethod;
}

export interface W3cV2SdJwtCredentialOfferOptions {
  bindingRequired?: boolean;
  bindingMethod?: W3cV2SdJwtBindingMethod;
  credential: JsonObject;
}

export class W3cV2SdJwtCredentialOffer {
  public constructor(options: W3cV2SdJwtCredentialOfferOptions) {
    if (options) {
      this.bindingRequired = options.bindingRequired;
      this.bindingMethod = options.bindingMethod;
      this.credential = options.credential;
    }
  }

  @IsOptional()
  @IsBoolean()
  @Expose({ name: "binding_required" })
  public bindingRequired?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => W3cV2SdJwtBindingMethod)
  @Expose({ name: "binding_method" })
  public bindingMethod?: W3cV2SdJwtBindingMethod;

  @Expose({ name: "credential" })
  public credential!: JsonObject;
}

export interface W3cV2SdJwtDidCommSignedAttachmentBindingProof {
  attachment_id: string;
}

export interface W3cV2SdJwtCredentialRequestBindingProof {
  didcomm_signed_attachment?: W3cV2SdJwtDidCommSignedAttachmentBindingProof;
}

export interface W3cV2SdJwtCredentialRequest {
  binding_proof?: W3cV2SdJwtCredentialRequestBindingProof;
}

export interface W3cV2SdJwtCredentialIssue {
  credential: string;
}
