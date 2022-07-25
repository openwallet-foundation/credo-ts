import type { JsonObject } from '../../../types'
import type { SingleOrArray } from '../../../utils/type'
import type { JsonLdOptionsRFC0593 } from '../../credentials/formats/jsonld/JsonLdOptionsRFC0593'
import type { ProofPurpose } from '../proof-purposes/ProofPurpose'
import type { W3cCredential } from './credential/W3cCredential'
import type { W3cVerifiableCredential } from './credential/W3cVerifiableCredential'
import type { W3cPresentation } from './presentation/W3Presentation'
import type { W3cVerifiablePresentation } from './presentation/W3cVerifiablePresentation'

export interface SignCredentialOptions {
  credential: W3cCredential
  proofType: string
  verificationMethod: string
  proofPurpose?: ProofPurpose
  created?: string
  domain?: string
  challenge?: string
  credentialStatus?: {
    type: string
  }
}

// FIXME move this into the jsonld format service

// feel free to rename this, the RFC suffix is useful during dev

export interface SignCredentialOptionsRFC0593 {
  credential: W3cCredential
  options: JsonLdOptionsRFC0593
  // verificationMethod: string
}

export interface VerifyCredentialOptions {
  credential: W3cVerifiableCredential
  proofPurpose?: ProofPurpose
}

export interface StoreCredentialOptions {
  credential: W3cVerifiableCredential
}

export interface CreatePresentationOptions {
  credentials: SingleOrArray<W3cVerifiableCredential>
  id?: string
  holderUrl?: string
}

export interface SignPresentationOptions {
  presentation: W3cPresentation
  signatureType: string
  purpose: ProofPurpose
  verificationMethod: string
  challenge: string
}

export interface VerifyPresentationOptions {
  presentation: W3cVerifiablePresentation
  proofType: string
  verificationMethod: string
  purpose?: ProofPurpose
  challenge?: string
}

export interface DeriveProofOptions {
  credential: W3cVerifiableCredential
  revealDocument: JsonObject
  verificationMethod: string
}
