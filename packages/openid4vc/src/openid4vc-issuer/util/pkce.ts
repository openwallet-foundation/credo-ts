import { Oauth2ErrorCodes, Oauth2ServerErrorResponseError, PkceCodeChallengeMethod } from '@openid4vc/oauth2'

/**
 * Extract and validate the PKCE parameters from an authorization request. The returned value
 * should be stored on the issuance session, so the `code_verifier` can be verified when the
 * authorization code is exchanged at the token endpoint.
 *
 * Only the `S256` code challenge method is supported, as advertised in the authorization server metadata.
 */
export function getPkceFromAuthorizationRequest(options: {
  authorizationRequest: { code_challenge?: string; code_challenge_method?: string }
  required: boolean
}): { codeChallenge: string; codeChallengeMethod: PkceCodeChallengeMethod.S256 } | undefined {
  const { code_challenge: codeChallenge, code_challenge_method: codeChallengeMethod } = options.authorizationRequest

  if (!codeChallenge) {
    if (options.required) {
      throw new Oauth2ServerErrorResponseError({
        error: Oauth2ErrorCodes.InvalidRequest,
        error_description: `Missing required 'code_challenge' parameter.`,
      })
    }

    return undefined
  }

  // NOTE: if 'code_challenge_method' is omitted it defaults to 'plain' (RFC 7636 section 4.3), which we don't support
  if (codeChallengeMethod !== PkceCodeChallengeMethod.S256) {
    throw new Oauth2ServerErrorResponseError({
      error: Oauth2ErrorCodes.InvalidRequest,
      error_description: `Unsupported 'code_challenge_method' '${codeChallengeMethod ?? PkceCodeChallengeMethod.Plain}'. Only '${PkceCodeChallengeMethod.S256}' is supported.`,
    })
  }

  return {
    codeChallenge,
    codeChallengeMethod,
  }
}
