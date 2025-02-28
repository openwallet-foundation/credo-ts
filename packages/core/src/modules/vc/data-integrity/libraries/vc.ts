import type { JsonObject } from '../../../../types'

// No type definitions available for this package
// @ts-ignore
import vc from '@digitalcredentials/vc'

export interface VC {
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  issue(options: any): Promise<Record<string, unknown>>
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  verifyCredential(options: any): Promise<W3cVerifyCredentialResult>
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  createPresentation(options: any): Promise<Record<string, unknown>>
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  signPresentation(options: any): Promise<Record<string, unknown>>
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
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
