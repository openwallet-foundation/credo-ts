import { HttpError } from 'http-errors'
import { OpenId4VcRequestContext } from '../shared/router'

export function logError(error: HttpError | Error | string, requestContext: OpenId4VcRequestContext) {
  const logger = requestContext.agentContext.config.logger
  if (error instanceof HttpError) {
    if (error.type === 'oauth2_error') {
      logger.warn(`[OID4VC] Sending oauth2 error response: ${JSON.stringify(error.message)}`, {
        error,
      })
    } else if ([401, 403].includes(error.statusCode)) {
      logger.warn(`[OID4VC] Sending authorization error response: ${JSON.stringify(error.message)}`, {
        error,
      })
    } else if (error.statusCode === 404) {
      logger.debug(`[OID4VC] Sending not found response: ${error.message}`, {
        error,
      })
    } else if (error.statusCode === 500) {
      logger.error('[OID4VC] Sending unknown server error response', {
        error,
      })
    } else {
      logger.error(`[OID4VC] Sending ${error.statusCode} server error response`, {
        error,
      })
    }
  } else {
    logger.warn('[OID4VC] Sending error response', {
      error,
    })
  }
}
