import type { Logger } from '@aries-framework/core'
import type { Response } from 'express'

import { AriesFrameworkError } from '@aries-framework/core'

export function sendErrorResponse(response: Response, logger: Logger, code: number, message: string, error: unknown) {
  const error_description =
    error instanceof Error ? error.message : typeof error === 'string' ? error : 'An unknown error occurred.'

  const body = { error: message, error_description }
  logger.warn(`[OID4VCI] Sending error response: ${JSON.stringify(body)}`)

  return response.status(code).json(body)
}

export function getEndpointMetadata(endpoint: string, base: string) {
  const baseUrl = new URL(base)

  // if the endpoint is relative, append it to origin of the base
  // if the endpoint is absolute, use the pathname
  const url = new URL(endpoint, baseUrl)

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new AriesFrameworkError(`Endpoint '${endpoint}' is not valid. Invalid protocol '${url.protocol}'`)
  }

  if (url.origin !== baseUrl.origin) {
    throw new AriesFrameworkError(`Endpoint '${endpoint}' is not valid. Invalid origin '${url}'`)
  }

  const path = url.pathname.replace(/\/$/, '')

  return { path, url }
}
