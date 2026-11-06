import type {
  IDisclosureFrame,
  JsonObject,
  Kms,
  SdJwtVcHolderBinding,
  W3cV2Credential,
  W3cV2Issuer,
} from '@credo-ts/core'
import type { DidCommCredentialFormat } from '../DidCommCredentialFormat'
import type { W3cV2SdJwtCredential, W3cV2SdJwtCredentialOffer, W3cV2SdJwtCredentialRequest } from './w3cV2SdJwtExchange'

export interface DidCommW3cV2SdJwtSignedAttachmentCreateOfferOptions {
  didMethodsSupported?: string[]
  algsSupported?: string[]
}

/**
 * Options for the holder to create a `didcomm_signed_attachment` binding proof, sent in the request.
 */
export interface DidCommW3cV2SdJwtSignedAttachmentCredentialRequestOptions {
  kid: string
  alg?: string
}

export interface DidCommW3cV2SdJwtOfferCredentialFormat {
  credential: W3cV2Credential | JsonObject
  bindingRequired?: boolean
  disclosureFrame?: IDisclosureFrame
  didCommSignedAttachmentBinding?: DidCommW3cV2SdJwtSignedAttachmentCreateOfferOptions
}

export interface DidCommW3cV2SdJwtAcceptOfferFormat {
  didCommSignedAttachment?: DidCommW3cV2SdJwtSignedAttachmentCredentialRequestOptions
}

export interface DidCommW3cV2SdJwtAcceptRequestFormat {
  /**
   * The issuer of the credential. RFC 881 allows an offer to omit the issuer when it is only known at
   * time of issuance, in which case it MUST be supplied here. Ignored when the offered credential
   * already has an issuer.
   */
  issuer?: string | W3cV2Issuer

  /**
   * The verification method of the credential issuer to sign the credential with. MUST belong to the
   * issuer of the credential and be listed under the `assertionMethod` purpose. When omitted, the first
   * `assertionMethod` verification method of the issuer is used.
   */
  issuerVerificationMethod?: string

  /**
   * The JWA signature algorithm to sign the credential with. When omitted, the first algorithm
   * supported by both the issuer key and the agent is used.
   */
  alg?: Kms.KnownJwaSignatureAlgorithm

  /**
   * The disclosure frame determining which claims are selectively disclosable. When omitted, it is
   * derived from the `selectively_disclosable_claims` of the offer.
   */
  disclosureFrame?: IDisclosureFrame

  /**
   * The holder to bind the credential to, adding a `cnf` claim to the issued credential. When omitted,
   * it is derived from the binding proof in the request.
   */
  holder?: SdJwtVcHolderBinding

  /**
   * The id to set on the credential subject. Useful for a bearer credential, where there is no binding
   * proof to derive the subject id from. Conflicts with a subject id already present on the offered
   * credential, or derived from the binding proof, are rejected.
   */
  credentialSubjectId?: string
}

export interface DidCommW3cV2SdJwtCredentialFormat extends DidCommCredentialFormat {
  formatKey: 'w3cV2SdJwt'
  credentialRecordType: 'w3c-v2'
  credentialFormats: {
    createProposal: never
    acceptProposal: never
    createOffer: DidCommW3cV2SdJwtOfferCredentialFormat
    acceptOffer: DidCommW3cV2SdJwtAcceptOfferFormat
    createRequest: never
    acceptRequest: DidCommW3cV2SdJwtAcceptRequestFormat
  }
  formatData: {
    proposal: never
    offer: W3cV2SdJwtCredentialOffer
    request: W3cV2SdJwtCredentialRequest
    credential: W3cV2SdJwtCredential
  }
}
