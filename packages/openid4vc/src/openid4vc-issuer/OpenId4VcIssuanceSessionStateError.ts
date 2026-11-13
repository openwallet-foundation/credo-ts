import { Oauth2ServerErrorResponseError } from '@openid4vc/oauth2'

/**
 * Thrown for a request that the state of the issuance session doesn't allow, for example because the credential was
 * already issued or the session finished. It doesn't end the session.
 */
export class OpenId4VcIssuanceSessionStateError extends Oauth2ServerErrorResponseError {}
