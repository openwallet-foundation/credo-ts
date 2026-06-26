import type {
  IDisclosureFrame,
  JsonObject,
  Kms,
  SdJwtVcHolderBinding,
  W3cV2Credential,
} from "@credo-ts/core";
import type { DidCommCredentialFormat } from "../DidCommCredentialFormat";
import type {
  W3cV2SdJwtCredentialIssue,
  W3cV2SdJwtCredentialOffer,
  W3cV2SdJwtCredentialRequest,
} from "./w3cV2SdJwtExchange";
import type { DidCommSignedAttachmentCredentialRequestOptions as DidCommSignedAttachmentAcceptOfferOptions } from "../dataIntegrity/dataIntegrityExchange";

export interface DidCommW3cV2SdJwtSignedAttachmentCreateOfferOptions {
  didMethodsSupported?: string[];
  algsSupported?: string[];
}

export interface DidCommW3cV2SdJwtOfferCredentialFormat {
  credential: W3cV2Credential | JsonObject;
  bindingRequired?: boolean;
  didCommSignedAttachmentBinding?: DidCommW3cV2SdJwtSignedAttachmentCreateOfferOptions;
}

export interface DidCommW3cV2SdJwtAcceptOfferFormat {
  didCommSignedAttachment?: DidCommSignedAttachmentAcceptOfferOptions;
}

export interface DidCommW3cV2SdJwtAcceptRequestFormat {
  verificationMethod?: string;
  alg?: Kms.KnownJwaSignatureAlgorithm;
  disclosureFrame?: IDisclosureFrame;
  holderBinding?: SdJwtVcHolderBinding;
}

export interface DidCommW3cV2SdJwtCredentialFormat extends DidCommCredentialFormat {
  formatKey: "w3cV2SdJwt";
  credentialRecordType: "w3c-v2";
  credentialFormats: {
    createProposal: never;
    acceptProposal: never;
    createOffer: DidCommW3cV2SdJwtOfferCredentialFormat;
    acceptOffer: DidCommW3cV2SdJwtAcceptOfferFormat;
    createRequest: never;
    acceptRequest: DidCommW3cV2SdJwtAcceptRequestFormat;
  };
  formatData: {
    proposal: never;
    offer: W3cV2SdJwtCredentialOffer;
    request: W3cV2SdJwtCredentialRequest;
    credential: W3cV2SdJwtCredentialIssue;
  };
}
