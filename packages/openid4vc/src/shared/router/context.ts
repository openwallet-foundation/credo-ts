import type { AgentContext, Logger } from '@credo-ts/core'
import { CredoError } from '@credo-ts/core'
import type { Oauth2ErrorCodes, Oauth2ServerErrorResponseError } from '@openid4vc/oauth2'
import { Oauth2ResourceUnauthorizedError, SupportedAuthenticationScheme } from '@openid4vc/oauth2'
import type { NextFunction, Request, Response } from 'express'

export interface OpenId4VcRequest<RC extends Record<string, unknown> = Record<string, never>> extends Request {
  requestContext?: RC & OpenId4VcRequestContext
}

export interface OpenId4VcRequestContext {
  agentContext: AgentContext
}

export function sendUnauthorizedError(
  response: Response,
  next: NextFunction,
  logger: Logger,
  error: unknown | Oauth2ResourceUnauthorizedError,
  status?: number
) {
  const errorMessage = error instanceof Error ? error.message : error
  logger.warn(`[OID4VC] Sending authorization error response: ${JSON.stringify(errorMessage)}`, {
    error,
  })

  const unauthorizedError =
    error instanceof Oauth2ResourceUnauthorizedError
      ? error
      : new Oauth2ResourceUnauthorizedError('Unknown error occurred', [
          { scheme: SupportedAuthenticationScheme.DPoP },
          { scheme: SupportedAuthenticationScheme.Bearer },
        ])

  response
    .setHeader('WWW-Authenticate', unauthorizedError.toHeaderValue())
    .status(status ?? 401)
    .send()
  next(error)
}

export function sendOauth2ErrorResponse(
  response: Response,
  next: NextFunction,
  logger: Logger,
  error: Oauth2ServerErrorResponseError
) {
  logger.warn(`[OID4VC] Sending oauth2 error response: ${JSON.stringify(error.message)}`, {
    error,
  })

  response.status(error.status).json(error.errorResponse)
  next(error)
}
export function sendUnknownServerErrorResponse(
  response: Response,
  next: NextFunction,
  logger: Logger,
  error: unknown,
  additionalParams: Record<string, unknown> = {}
) {
  logger.error('[OID4VC] Sending unknown server error response', {
    error,
  })

  response.status(500).json({
    error: 'server_error',
    ...additionalParams,
  })

  const throwError =
    error instanceof Error ? error : new CredoError('Unknown error in openid4vc error response handler')
  next(throwError)
}

export function sendNotFoundResponse(response: Response, next: NextFunction, logger: Logger, internalReason: string) {
  logger.debug(`[OID4VC] Sending not found response: ${internalReason}`)

  response.status(404).send()
  next(new CredoError(internalReason))
}

export function sendErrorResponse(
  response: Response,
  next: NextFunction,
  logger: Logger,
  status: number,
  errorCode: Oauth2ErrorCodes | string,
  errorDescription?: string,
  additionalPayload?: Record<string, unknown>,
  error?: Error
) {
  const body = {
    error: errorCode,
    error_description: errorDescription,
    ...additionalPayload,
  }
  logger.warn(`[OID4VC] Sending error response: ${JSON.stringify(body)}`, {
    error,
  })

  response.status(status).json(body)

  const throwError =
    error instanceof Error ? error : new CredoError('Unknown error in openid4vc error response handler')
  next(throwError)
}

export function sendJsonResponse(
  response: Response,
  next: NextFunction,
  // biome-ignore lint/suspicious/noExplicitAny: no explanation
  body: any,
  contentType?: string,
  status?: number
) {
  response
    .setHeader('Content-Type', contentType ?? 'application/json')
    .status(status ?? 200)
    .send(JSON.stringify(body))

  next()
}

/**
 * Sends a 413 response if the body parser rejected the request body as too large. Returns whether it did.
 */
export function sendPayloadTooLargeResponse(response: Response, error: unknown) {
  if (!(error instanceof Error) || error.name !== 'PayloadTooLargeError') return false

  response.status(413).json({
    error: 'invalid_request',
    message: 'The request body exceeds the maximum allowed limit.',
  })
  return true
}

const requestSessions = new WeakMap<Request, () => Promise<void>>()

/**
 * Ends the agent context session for the request once: when the router calls {@link endRequestSession},
 * or when the response finishes, so a handler that sends a response without calling `next()` can't leak it.
 */
export function registerRequestSession(request: Request, response: Response, agentContext: AgentContext) {
  let endSessionPromise: Promise<void> | undefined
  const endSession = () => {
    endSessionPromise ??= agentContext.endSession()
    return endSessionPromise
  }

  requestSessions.set(request, endSession)
  response.once('finish', () => {
    // Leaving a nested router defers `next()` by a `setImmediate`, so the router can still end the session after 'finish'
    setImmediate(() => {
      if (endSessionPromise) return

      agentContext.config.logger.warn(
        `[OID4VC] Agent context session for ${request.method} ${request.originalUrl} was not ended by the router, a handler probably did not call next(). Ending it after the response.`
      )
      endSession().catch((error) => {
        agentContext.config.logger.error('[OID4VC] Failed to end agent context session after response', { error })
      })
    })
  })
}

export async function endRequestSession(request: Request) {
  await requestSessions.get(request)?.()
}

// biome-ignore lint/suspicious/noExplicitAny: no explanation
export function getRequestContext<T extends OpenId4VcRequest<any>>(request: T): NonNullable<T['requestContext']> {
  const requestContext = request.requestContext
  if (!requestContext) throw new CredoError('Request context not set.')

  return requestContext
}
