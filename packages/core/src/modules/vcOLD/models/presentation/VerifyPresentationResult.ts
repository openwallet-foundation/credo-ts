import type { JsonObject } from '../../../../types'
import type { VerifyCredentialResult } from '../credential/W3cVerifyCredentialResult'

export interface VerifyPresentationResult {
  verified: boolean
  presentationResult: JsonObject // the precise interface of this object is still unclear
  credentialResults: Array<VerifyCredentialResult>
  error?: Error
}
