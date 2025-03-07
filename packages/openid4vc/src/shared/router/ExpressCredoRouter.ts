import { IncomingMessage } from 'http'
import type { Router } from 'express'
import { CredoHttpResponse, CredoRouter } from './CredoRouter'
import { sendJsonResponse } from './context'

export class ExpressCredoRouter implements CredoRouter {
  constructor(public expressRouter: Router) {}
  post<HttpRequestType extends IncomingMessage, HttpResponseBodyType>(
    path: string,
    handler: (
      req: HttpRequestType
    ) => Promise<HttpResponseBodyType | CredoHttpResponse<HttpResponseBodyType> | undefined>
  ) {
    this.expressRouter.post(path, async (req, res, next) => {
      const result = await handler(req as unknown as HttpRequestType)
      if (result == null) {
        res.status(204).send()
      } else if (typeof result === 'object' && 'statusCode' in result) {
        sendJsonResponse(res, next, result, 'application/json', result.statusCode)
      } else {
        sendJsonResponse(res, next, result)
      }
    })
    return this
  }
}
