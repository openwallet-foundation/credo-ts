import type { AgentContext, Logger } from '@credo-ts/core'
import type { Oauth2ErrorCodes, Oauth2ServerErrorResponseError } from '@openid4vc/oauth2'
import type { NextFunction, Request, Response } from 'express'

import { CredoError } from '@credo-ts/core'
import { Oauth2ResourceUnauthorizedError, SupportedAuthenticationScheme } from '@openid4vc/oauth2'

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

  const unauhorizedError =
    error instanceof Oauth2ResourceUnauthorizedError
      ? error
      : new Oauth2ResourceUnauthorizedError('Unknown error occured', [
          { scheme: SupportedAuthenticationScheme.DPoP },
          { scheme: SupportedAuthenticationScheme.Bearer },
        ])

  response
    .setHeader('WWW-Authenticate', unauhorizedError.toHeaderValue())
    .status(status ?? 403)
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
export function sendUnknownServerErrorResponse(response: Response, next: NextFunction, logger: Logger, error: unknown) {
  logger.error('[OID4VC] Sending unknown server error response', {
    error,
  })

  response.status(500).json({
    error: 'server_error',
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
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
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

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export function getRequestContext<T extends OpenId4VcRequest<any>>(request: T): NonNullable<T['requestContext']> {
  const requestContext = request.requestContext
  if (!requestContext) throw new CredoError('Request context not set.')

  return requestContext
}
