import { TypedArrayEncoder, utils } from '@aries-framework/core'

/**
 * generates a string that adheres to the format of a legacy indy did.
 *
 * This can be used for the `prover_did` property that is required in the legacy anoncreds credential
 * request. This doesn't actually have to be a did, but some frameworks (like ACA-Py) require it to be
 * an unqualified indy did.
 */
export function generateLegacyProverDidLikeString() {
  return TypedArrayEncoder.toBase58(TypedArrayEncoder.fromString(utils.uuid()).slice(0, 16))
}
