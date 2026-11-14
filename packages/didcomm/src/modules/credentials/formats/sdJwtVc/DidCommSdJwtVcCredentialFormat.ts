import type { ClaimPath, Kms, SdJwtVcPayload, XOR } from '@credo-ts/core'
import type {
  DidCommSignedAttachmentCreateOfferOptions,
  DidCommSignedAttachmentCredentialRequestOptions,
} from '../../util/didCommSignedAttachmentBinding'
import type { DidCommCredentialFormat } from '../DidCommCredentialFormat'
import type { SdJwtVcCredential, SdJwtVcCredentialOffer, SdJwtVcCredentialRequest } from './sdJwtVcExchange'

export interface DidCommSdJwtVcSignedAttachmentCreateOfferOptions extends DidCommSignedAttachmentCreateOfferOptions {
  /** Accept a binding proof signed with a bare key in a `jwk` header. `didMethodsSupported` can then be empty. */
  jwkSupported?: boolean
}

export interface DidCommSdJwtVcOfferCredentialFormat {
  /**
   * `iss` must be the issuer DID, without a path, query or fragment. A `status` mechanism can omit its members,
   * as in `{ status_list: {} }`, and `acceptRequest` then sets them with `status`.
   */
  credential: SdJwtVcPayload
  bindingRequired?: boolean
  selectivelyDisclosableClaims?: ClaimPath[]
  didCommSignedAttachmentBinding?: DidCommSdJwtVcSignedAttachmentCreateOfferOptions
}

export interface DidCommSdJwtVcAcceptOfferFormat {
  didCommSignedAttachment?: XOR<DidCommSignedAttachmentCredentialRequestOptions, { alg?: string; jwk: Kms.PublicJwk }>
}

export interface DidCommSdJwtVcAcceptRequestFormat {
  /** The `assertionMethod` verification method of the issuer to sign with. Defaults to the first one. */
  issuerVerificationMethod?: string
  /** Merged into the offered `status`, to fill the status mechanisms the offer named with their members omitted. */
  status?: SdJwtVcPayload['status']
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
