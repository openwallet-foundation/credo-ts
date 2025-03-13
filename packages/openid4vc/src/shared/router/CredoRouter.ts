import http from 'node:http'

export interface CredoHttpResponse<HttpResponseBodyType> {
  statusCode: number
  headers?: { [key: string]: string }
  body?: HttpResponseBodyType
}

export interface CredoRouter {
  post<HttpRequestType extends http.IncomingMessage, HttpResponseBodyType>(
    path: string,
    handler: (
      req: HttpRequestType
    ) => Promise<HttpResponseBodyType | CredoHttpResponse<HttpResponseBodyType> | undefined>
  ): CredoRouter
}
