import type { ClaimPath, Kms, SdJwtVcPayload, XOR } from '@credo-ts/core'
import type { DidCommCredentialFormat } from '../DidCommCredentialFormat'
import type {
  DidCommW3cV2SdJwtSignedAttachmentCreateOfferOptions,
  DidCommW3cV2SdJwtSignedAttachmentCredentialRequestOptions,
} from '../w3cV2SdJwt/DidCommW3cV2SdJwtCredentialFormat'
import type { SdJwtVcCredential, SdJwtVcCredentialOffer, SdJwtVcCredentialRequest } from './sdJwtVcExchange'

export interface DidCommSdJwtVcSignedAttachmentCreateOfferOptions
  extends DidCommW3cV2SdJwtSignedAttachmentCreateOfferOptions {
  /** Accept a binding proof signed with a bare key in a `jwk` header. `didMethodsSupported` can then be empty. */
  jwkSupported?: boolean
}

export interface DidCommSdJwtVcOfferCredentialFormat {
  /** `iss` must be the issuer DID, without a path, query or fragment. A `status` mechanism must have all its members. */
  credential: SdJwtVcPayload
  bindingRequired?: boolean
  selectivelyDisclosableClaims?: ClaimPath[]
  didCommSignedAttachmentBinding?: DidCommSdJwtVcSignedAttachmentCreateOfferOptions
}

export interface DidCommSdJwtVcAcceptOfferFormat {
  didCommSignedAttachment?: XOR<
    DidCommW3cV2SdJwtSignedAttachmentCredentialRequestOptions,
    { alg?: string; jwk: Kms.PublicJwk }
  >
}

export interface DidCommSdJwtVcAcceptRequestFormat {
  /** The `assertionMethod` verification method of the issuer to sign with. Defaults to the first one. */
  issuerVerificationMethod?: string
}

export interface DidCommSdJwtVcCredentialFormat extends DidCommCredentialFormat {
  formatKey: 'sdJwtVc'
  credentialRecordType: 'sd-jwt-vc'
  credentialFormats: {
    createProposal: never
    acceptProposal: never
    createOffer: DidCommSdJwtVcOfferCredentialFormat
    acceptOffer: DidCommSdJwtVcAcceptOfferFormat
    createRequest: never
    acceptRequest: DidCommSdJwtVcAcceptRequestFormat
  }
  formatData: {
    proposal: never
    offer: SdJwtVcCredentialOffer
    request: SdJwtVcCredentialRequest
    credential: SdJwtVcCredential
  }
}
