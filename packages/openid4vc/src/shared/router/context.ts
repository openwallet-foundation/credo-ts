import type { AgentContext, Logger } from '@credo-ts/core'
import type { Oauth2ErrorCodes, Oauth2ServerErrorResponseError } from '@openid4vc/oauth2'
import type { NextFunction, Request, Response, Router } from 'express'

import * as http from 'node:http'
import { CredoError } from '@credo-ts/core'
import { FastifyInstance } from 'fastify'

export interface HasRequestContext<RC extends Record<string, unknown>> {
  requestContext?: RC & OpenId4VcRequestContext
}

export interface OpenId4VcRequest<RC extends Record<string, unknown> = Record<string, never>>
  extends Request,
    HasRequestContext<RC> {}

export interface OpenId4VcPostRequest<BodyType, RC extends Record<string, unknown> = Record<string, never>>
  extends http.IncomingMessage,
    HasRequestContext<RC> {
  body: BodyType
}

export interface OpenId4VcRequestContext {
  agentContext: AgentContext
}

export type SupportedRouterTypes = Router | FastifyInstance

/* TODO move out of context to express specific helpers */
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
export function getRequestContext<T extends HasRequestContext<any>>(request: T): NonNullable<T['requestContext']> {
  const requestContext = request.requestContext
  if (!requestContext) throw new CredoError('Request context not set.')

  return requestContext
}
