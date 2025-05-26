import { encodeWwwAuthenticateHeader } from '@openid4vc/utils'

import { WwwAuthenticateHeaderChallenge } from '@openid4vc/oauth2'
import createHttpError from 'http-errors'

export function oauth2Error(errorCode: string, message: string, status = 400) {
  return createHttpError(status, message, {
    type: 'oauth2_error',
    errorResponse: { error: errorCode },
  })
}

export function oauth2UnauthorizedError(message: string, wwwAuthenticateHeaders: WwwAuthenticateHeaderChallenge[]) {
  return createHttpError(403, message, {
    type: 'oauth2_error',
    headers: {
      'WWW-Authenticate': encodeWwwAuthenticateHeader(
        wwwAuthenticateHeaders.map((header) => ({
          scheme: header.scheme,
          payload: {
            error: header.error ?? null,
            error_description: header.error_description ?? null,
            scope: header.scope ?? null,
          },
          ...header.additionalPayload,
        }))
      ),
    },
  })
}
