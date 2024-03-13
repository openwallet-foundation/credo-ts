import type { OpenId4VciCredentialRequest } from '../../shared'

import { Jwt, CredoError } from '@credo-ts/core'

/**
 * Extract the 'nonce' parameter from the JWT payload of the credential request.
 */
export function getCNonceFromCredentialRequest(credentialRequest: OpenId4VciCredentialRequest) {
  if (!credentialRequest.proof?.jwt) throw new CredoError('No jwt in the credentialRequest proof.')
  const jwt = Jwt.fromSerializedJwt(credentialRequest.proof.jwt)
  if (!jwt.payload.additionalClaims.nonce || typeof jwt.payload.additionalClaims.nonce !== 'string')
    throw new CredoError('No nonce in the credentialRequest JWT proof payload.')
  return jwt.payload.additionalClaims.nonce
}
