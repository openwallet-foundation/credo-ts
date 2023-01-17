import type { W3cVerifiableCredential } from './W3cVerifiableCredential'
import type { JsonObject } from '../../../../types'

export interface VerifyCredentialResult {
  credential: W3cVerifiableCredential
  verified: boolean
  error?: Error
}

export interface W3cVerifyCredentialResult {
  verified: boolean
  statusResult: JsonObject
  results: Array<VerifyCredentialResult>
  error?: Error
}
