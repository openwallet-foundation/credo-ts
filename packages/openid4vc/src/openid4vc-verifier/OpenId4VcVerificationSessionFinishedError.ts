import { Oauth2ErrorCodes, Oauth2ServerErrorResponseError } from '@openid4vc/oauth2'

/**
 * Thrown when a verification session no longer waits for a response, because another response already ended it.
 */
export class OpenId4VcVerificationSessionFinishedError extends Oauth2ServerErrorResponseError {
  public constructor() {
    super({ error: Oauth2ErrorCodes.InvalidRequest, error_description: 'Invalid session' })
  }
}
