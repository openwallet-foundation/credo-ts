import type { ClaimPath } from '@credo-ts/core'
import type {
  DidCommSignedAttachmentWithJwkCreateOfferOptions,
  DidCommSignedAttachmentWithJwkCredentialRequestOptions,
} from '../../util/didCommSignedAttachmentBinding'
import type { DidCommCredentialFormat } from '../DidCommCredentialFormat'
import type {
  SdJwtVcCredential,
  SdJwtVcCredentialOffer,
  SdJwtVcCredentialOfferPayload,
  SdJwtVcCredentialRequest,
} from './sdJwtVcExchange'

export interface DidCommSdJwtVcOfferCredentialFormat {
  /** `iss` must be the issuer DID, without a path, query or fragment. */
  credential: SdJwtVcCredentialOfferPayload
  bindingRequired?: boolean
  selectivelyDisclosableClaims?: ClaimPath[]
  didCommSignedAttachmentBinding?: DidCommSignedAttachmentWithJwkCreateOfferOptions
}

export interface DidCommSdJwtVcAcceptOfferFormat {
  didCommSignedAttachment?: DidCommSignedAttachmentWithJwkCredentialRequestOptions
}

export interface DidCommSdJwtVcAcceptRequestFormat {
  /** The `assertionMethod` verification method of the issuer to sign with. Defaults to the first one. */
  issuerVerificationMethod?: string
  /** Merged into the offered `status`, to fill the status mechanisms the offer named with their members omitted. */
  status?: SdJwtVcCredentialOfferPayload['status']
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
