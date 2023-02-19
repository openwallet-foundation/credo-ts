import type { W3cCredential } from './credential/W3cCredential'
import type { W3cVerifiableCredential } from './credential/W3cVerifiableCredential'
import type { W3cPresentation } from './presentation/W3cPresentation'
import type { W3cVerifiablePresentation } from './presentation/W3cVerifiablePresentation'
import type { JsonObject } from '../../../types'
import type { SingleOrArray } from '../../../utils/type'
import type { ProofPurpose } from '../proof-purposes/ProofPurpose'

export interface SignCredentialOptions {
  credential: W3cCredential
  proofType: string
  verificationMethod: string
  proofPurpose?: ProofPurpose
  created?: string
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
  purpose?: ProofPurpose
  challenge?: string
}

export interface DeriveProofOptions {
  credential: W3cVerifiableCredential
  revealDocument: JsonObject
  verificationMethod: string
}
