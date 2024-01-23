import type { JsonObject } from '../../../..'

export type W3C_VC_DATA_MODEL_VERSION = '1.1' | '2.0'

// This binding method is intended to be used in combination with a credential containing an AnonCreds proof.
export interface AnonCredsLinkSecretBindingMethod {
  cred_def_id: string
  nonce: string
  key_correctness_proof: Record<string, unknown>
}

export interface DidCommSignedAttachmentBindingMethod {
  algs_supported: string[]
  did_methods_supported: string[]
  nonce: string
}

export interface DataIntegrityBindingMethods {
  anoncreds_link_secret?: AnonCredsLinkSecretBindingMethod
  didcomm_signed_attachment?: DidCommSignedAttachmentBindingMethod
}

export interface DataIntegrityCredentialOffer {
  // List of strings indicating the supported VC Data Model versions.
  // The list MUST contain at least one value. The values MUST be a valid data model version. Current supported values include 1.1 and 2.0.
  data_model_versions_supported: W3C_VC_DATA_MODEL_VERSION[]
  // Boolean indicating whether the credential MUST be bound to the holder. If omitted, the credential is not required to be bound to the holder.
  // If set to true, the credential MUST be bound to the holder using at least one of the binding methods defined in binding_method.
  binding_required?: boolean
  // Required if binding_required is true.
  // Object containing key-value pairs of binding methods supported by the issuer to bind the credential to a holder.
  // If the value is omitted, this indicates the issuer does not support any binding methods for issuance of the credential.
  binding_method?: DataIntegrityBindingMethods
  // The credential should be compliant with the VC Data Model.
  // The credential MUST NOT contain any proofs.
  // Some properties MAY be omitted if they will only be available at time of issuance, such as issuanceDate, issuer, credentialSubject.id, credentialStatus, credentialStatus.id.
  // The credential MUST be conformant with one of the data model versions indicated in data_model_versions_supported.
  credential: JsonObject
}

export interface AnonCredsLinkSecretDataIntegrityBindingProof {
  cred_def_id: string
  entropy: string
  blinded_ms: Record<string, unknown>
  blinded_ms_correctness_proof: Record<string, unknown>
  nonce: string
}

export interface DidCommSignedAttachmentDataIntegrityBindingProof {
  // The id of the appended attachment included in the request message that contains the signed attachment.
  attachment_id: string
}

export interface DataIntegrityCredentialRequestBindingProof {
  anoncreds_link_secret?: AnonCredsLinkSecretDataIntegrityBindingProof
  didcomm_signed_attachment?: DidCommSignedAttachmentDataIntegrityBindingProof
}

export interface DataIntegrityCredentialRequest {
  // The data model version of the credential to be issued. The value MUST be a valid data model version and match one of the values from the data_model_versions_supported offer.
  data_model_version: W3C_VC_DATA_MODEL_VERSION
  // Required if binding_required is true in the offer.
  // Object containing key-value pairs of proofs for the binding to the holder.
  // The keys MUST match keys of the binding_method object from the offer.
  // See Binding Methods for a registry of default binding methods supported as part of this RFC.
  binding_proof?: DataIntegrityCredentialRequestBindingProof
}

export interface AnonCredsLinkSecretCredentialRequestOptions {
  linkSecretId?: string
}

export interface DidCommSignedAttachmentCredentialRequestOptions {
  kid: string
  alg?: string
}

export interface DataIntegrityCredential {
  credential: JsonObject
}
