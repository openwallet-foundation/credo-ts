import type { VerificationTypeCredential } from '@credo-ts/core'
import type { DidCommProofExchangeRecord } from './modules/proofs/repository'

/**
 * Credential verification bound to a DIDComm proof exchange. Used instead of the core `VerificationTypeCredential`
 * when the credential is verified as part of a presentation received in a DIDComm proof exchange.
 */
export type DidCommVerificationTypeProofCredential = {
  type: 'didCommProofCredential'
  didCommProofExchangeRecord: DidCommProofExchangeRecord
  credential: VerificationTypeCredential['credential']
}

/**
 * Union of all DIDComm-specific verification types. Pass this as the additional verification types generic
 * parameter to `GetTrustedIssuersForVerification` to get full type coverage:
 *
 * ```ts
 * const getTrustedIssuersForVerification: GetTrustedIssuersForVerification<
 *   VerificationSigner,
 *   DidCommVerificationTypes
 * > = async (agentContext, { verification, signer }) => { ... }
 * ```
 */
export type DidCommVerificationTypes = DidCommVerificationTypeProofCredential
