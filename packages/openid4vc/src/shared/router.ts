import type { AgentContextProvider, Logger } from '@aries-framework/core'
import type { Response, Request } from 'express'

import { AriesFrameworkError, WalletApi } from '@aries-framework/core'
import path from 'path'

export function sendErrorResponse(response: Response, logger: Logger, code: number, message: string, error: unknown) {
  const error_description =
    error instanceof Error ? error.message : typeof error === 'string' ? error : 'An unknown error occurred.'

  const body = { error: message, error_description }
  logger.warn(`[OID4VCI] Sending error response: ${JSON.stringify(body)}`)

  return response.status(code).json(body)
}

export function getRequestContext<T extends Request & { requestContext?: unknown }>(
  request: T
): NonNullable<T['requestContext']> {
  const requestContext = request.requestContext
  if (!requestContext) throw new AriesFrameworkError('Request context not set.')

  return requestContext
}

export async function initializeAgentFromContext(contextCorrelationId: string, contextProvider: AgentContextProvider) {
  const agentContext = await contextProvider.getAgentContextForContextCorrelationId(contextCorrelationId)

  const { walletConfig } = agentContext.config

  const walletApi = agentContext.dependencyManager.resolve(WalletApi)
  if (!walletApi.isInitialized && walletConfig) {
    await walletApi.initialize(walletConfig)
  }

  return agentContext
}

export function getEndpointUrl(base: string, basePath: string, endpoint = '/') {
  const baseUrl = new URL(base)

  if (URL.canParse(endpoint)) throw new AriesFrameworkError(`Endpoint must be relative not absolute: '${endpoint}'`)

  // if the endpoint is relative, append it to origin of the base
  // if the endpoint is absolute, use the pathname
  const endpointPath = path.join(basePath, endpoint)
  const url =
    endpointPath === '' || endpointPath === '/' || endpointPath === '.' ? baseUrl : new URL(endpointPath, baseUrl)

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new AriesFrameworkError(`Endpoint '${endpoint}' is not valid. Invalid protocol '${url.protocol}'`)
  }

  if (url.origin !== baseUrl.origin) {
    throw new AriesFrameworkError(`Endpoint '${endpoint}' is not valid. Invalid origin '${url}'`)
  }

  return url.href.replace(/\/$/, '')
}
