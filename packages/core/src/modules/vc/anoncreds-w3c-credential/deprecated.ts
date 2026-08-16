import { AnonCredsW3cCredentialProof, type AnonCredsW3cCredentialProofOptions } from './AnonCredsW3cCredentialProof'
import {
  ANONCREDS_W3C_CREDENTIAL_CRYPTOSUITE,
  type AnonCredsW3cCredentialCreatePresentation,
  AnonCredsW3cCredentialServiceSymbol,
  type AnonCredsW3cCredentialVerifyPresentation,
  type IAnonCredsW3cCredentialService,
} from './IAnonCredsW3cCredentialService'

/** @deprecated Use {@link AnonCredsW3cCredentialProof} instead */
export const DataIntegrityProof = AnonCredsW3cCredentialProof

/** @deprecated Use {@link AnonCredsW3cCredentialProofOptions} instead */
export type DataIntegrityProofOptions = AnonCredsW3cCredentialProofOptions

/** @deprecated Use {@link ANONCREDS_W3C_CREDENTIAL_CRYPTOSUITE} instead */
export const ANONCREDS_DATA_INTEGRITY_CRYPTOSUITE = ANONCREDS_W3C_CREDENTIAL_CRYPTOSUITE

/** @deprecated Use {@link AnonCredsW3cCredentialCreatePresentation} instead */
export type AnoncredsDataIntegrityCreatePresentation = AnonCredsW3cCredentialCreatePresentation

/** @deprecated Use {@link AnonCredsW3cCredentialServiceSymbol} instead */
export const AnonCredsDataIntegrityServiceSymbol = AnonCredsW3cCredentialServiceSymbol

/** @deprecated Use {@link AnonCredsW3cCredentialVerifyPresentation} instead */
export type AnoncredsDataIntegrityVerifyPresentation = AnonCredsW3cCredentialVerifyPresentation

/** @deprecated Use {@link IAnonCredsW3cCredentialService} instead */
export type IAnonCredsDataIntegrityService = IAnonCredsW3cCredentialService
