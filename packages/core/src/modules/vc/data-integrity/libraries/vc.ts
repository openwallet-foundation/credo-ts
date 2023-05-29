/* eslint-disable @typescript-eslint/no-explicit-any */

import type { JsonObject } from '../../../../types'

// No type definitions available for this package
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import vc from '@digitalcredentials/vc'

export interface VC {
  issue(options: any): Promise<Record<string, unknown>>
  verifyCredential(options: any): Promise<W3cVerifyCredentialResult>
  createPresentation(options: any): Promise<Record<string, unknown>>
  signPresentation(options: any): Promise<Record<string, unknown>>
  verify(options: any): Promise<W3cVerifyPresentationResult>
}

interface W3cVerificationResult {
  isValid: boolean

  error?: Error

  verificationMethod?: JsonObject
  proof?: JsonObject
  purposeResult?: JsonObject
}

export interface W3cVerifyCredentialResult {
  verified: boolean
  error?: Error
  results: W3cVerificationResult[]
}

export interface W3cVerifyPresentationResult {
  verified: boolean
  error?: Error

  presentationResult: W3cVerificationResult
  credentialResults: W3cVerifyCredentialResult[]
}

export default vc as unknown as VC
