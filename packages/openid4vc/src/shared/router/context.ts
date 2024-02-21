import type { AgentContext, Logger } from '@credo-ts/core'
import type { Response, Request } from 'express'

import { CredoError } from '@credo-ts/core'

export interface OpenId4VcRequest<RC extends Record<string, unknown> = Record<string, never>> extends Request {
  requestContext?: RC & OpenId4VcRequestContext
}

export interface OpenId4VcRequestContext {
  agentContext: AgentContext
}

export function sendErrorResponse(response: Response, logger: Logger, code: number, message: string, error: unknown) {
  const error_description =
    error instanceof Error ? error.message : typeof error === 'string' ? error : 'An unknown error occurred.'

  const body = { error: message, error_description }
  logger.warn(`[OID4VCI] Sending error response: ${JSON.stringify(body)}`, {
    error,
  })

  return response.status(code).json(body)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getRequestContext<T extends OpenId4VcRequest<any>>(request: T): NonNullable<T['requestContext']> {
  const requestContext = request.requestContext
  if (!requestContext) throw new CredoError('Request context not set.')

  return requestContext
}
