import type { HttpHandler, HttpHandlerHost, HttpRequest } from '@credo-ts/core/http'
import type { Express, NextFunction, Request, Response } from 'express'
import { raw } from 'express'

export type ExpressHostOptions = { app: Express }

/**
 * Adapts Fetch-style HTTP handlers to an application-owned Express app without managing its listener.
 */
export class ExpressHost implements HttpHandlerHost {
  public readonly app: Express
  private readonly attachedHandlers = new Set<HttpHandler>()
  private lifecycle: Promise<void> = Promise.resolve()

  public constructor({ app }: ExpressHostOptions) {
    this.app = app

    this.app.use((request, response, next) => {
      void this.dispatch(request, response, next).catch(next)
    })
  }

  public attach(handler: HttpHandler): Promise<void> {
    return this.enqueue(async () => {
      if (this.attachedHandlers.has(handler)) return

      validateHandler(handler)
      this.attachedHandlers.add(handler)
    })
  }

  public detach(handler: HttpHandler): Promise<void> {
    return this.enqueue(async () => {
      this.attachedHandlers.delete(handler)
    })
  }

  private async dispatch(request: Request, response: Response, next: NextFunction): Promise<void> {
    const pathname = requestPathname(request)
    const handlers = [...this.attachedHandlers].filter((handler) =>
      handler.pathPrefixes.some((prefix) => pathMatchesPrefix(pathname, prefix))
    )
    if (handlers.length === 0) return next()

    const maxRequestBodyBytes = Math.max(...handlers.map((handler) => handler.maxRequestBodyBytes))
    raw({ type: () => true, limit: maxRequestBodyBytes })(request, response, (error?: unknown) => {
      if (error) {
        next(error)
        return
      }

      void this.dispatchHandlers(handlers, request, response, next, pathname)
    })
  }

  private async dispatchHandlers(
    handlers: HttpHandler[],
    request: Request,
    response: Response,
    next: NextFunction,
    pathname: string
  ): Promise<void> {
    const abortController = new AbortController()
    const onClose = () => {
      if (!response.writableEnded) abortController.abort()
    }
    response.once('close', onClose)

    try {
      for (const handler of handlers) {
        const fetchRequest = toFetchRequest(request, pathname, abortController.signal)
        const result = await handler.handle(fetchRequest)
        if (result) {
          await writeFetchResponse(result, request, response)
          return
        }
        if (fetchRequest.bodyUsed) {
          throw new TypeError('An HTTP handler consumed the request body before returning undefined')
        }
      }

      if (!response.destroyed) next()
    } catch (error) {
      next(error)
    } finally {
      response.off('close', onClose)
    }
  }

  private enqueue(operation: () => Promise<void>): Promise<void> {
    const result = this.lifecycle.then(operation, operation)
    this.lifecycle = result.catch(() => undefined)
    return result
  }
}

/**
 * Attaches Fetch-style HTTP handlers to an application-owned Express app without managing its listener.
 */
export function expressHost(options: { app: Express }): ExpressHost {
  return new ExpressHost(options)
}

function validateHandler(handler: HttpHandler): void {
  if (!Number.isSafeInteger(handler.maxRequestBodyBytes) || handler.maxRequestBodyBytes < 0) {
    throw new RangeError('HTTP handler maxRequestBodyBytes must be a non-negative safe integer')
  }
  if (handler.pathPrefixes.length === 0 || handler.pathPrefixes.some((prefix) => !prefix.startsWith('/'))) {
    throw new Error('HTTP handler pathPrefixes must contain absolute paths')
  }
}

function requestPathname(request: Request): string {
  return new URL(request.originalUrl, `${request.protocol}://${request.headers.host ?? 'localhost'}`).pathname
}

function pathMatchesPrefix(pathname: string, prefix: string): boolean {
  if (prefix === '/') return true
  return pathname === prefix || pathname.startsWith(prefix.endsWith('/') ? prefix : `${prefix}/`)
}

function toFetchRequest(request: Request, pathname: string, signal: AbortSignal): HttpRequest {
  const headers = new Headers()
  for (const [name, value] of Object.entries(request.headers)) {
    if (value === undefined) continue
    for (const headerValue of Array.isArray(value) ? value : [value]) headers.append(name, headerValue)
  }

  const method = request.method.toUpperCase()
  const body = requestBody(request, headers)
  const url = new URL(request.originalUrl, `${request.protocol}://${request.headers.host ?? 'localhost'}`)
  url.pathname = pathname

  return new globalThis.Request(url, {
    method,
    headers,
    signal,
    ...(body === undefined || method === 'GET' || method === 'HEAD' ? {} : { body }),
  })
}

function requestBody(request: Request, headers: Headers): Uint8Array | URLSearchParams | string | undefined {
  const body: unknown = request.body
  if (body === undefined) return undefined
  if (typeof body === 'string' || body instanceof Uint8Array || body instanceof URLSearchParams) return body

  const mediaType = headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase()
  if (isRecord(body) && isJsonMediaType(mediaType)) {
    return JSON.stringify(body)
  }
  if (isRecord(body) && mediaType === 'application/x-www-form-urlencoded') {
    return encodeForm(body)
  }

  throw new TypeError(`Cannot rebuild the consumed Express request body for content type '${mediaType ?? 'unknown'}'`)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isJsonMediaType(mediaType: string | undefined): boolean {
  return mediaType === 'application/json' || mediaType?.endsWith('+json') === true
}

function encodeForm(body: Record<string, unknown>): URLSearchParams {
  const parameters = new URLSearchParams()
  for (const [key, value] of Object.entries(body)) appendFormValue(parameters, key, value)
  return parameters
}

function appendFormValue(parameters: URLSearchParams, key: string, value: unknown): void {
  if (Array.isArray(value)) {
    for (const entry of value) appendFormValue(parameters, key, entry)
  } else if (isRecord(value)) {
    for (const [nestedKey, nestedValue] of Object.entries(value)) {
      appendFormValue(parameters, `${key}[${nestedKey}]`, nestedValue)
    }
  } else {
    parameters.append(key, value === null ? '' : String(value))
  }
}

async function writeFetchResponse(result: globalThis.Response, request: Request, response: Response): Promise<void> {
  if (response.headersSent || response.writableEnded || response.destroyed) return

  response.status(result.status)
  result.headers.forEach((value, key) => {
    if (key !== 'set-cookie') response.setHeader(key, value)
  })
  const setCookies = result.headers.getSetCookie()
  if (setCookies.length > 0) response.setHeader('set-cookie', setCookies)

  const body = request.method === 'HEAD' || !result.body ? undefined : new Uint8Array(await result.arrayBuffer())
  response.end(body)
}
