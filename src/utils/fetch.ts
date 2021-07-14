/* eslint-disable @typescript-eslint/ban-ts-comment */

import type { AbortSignal } from 'abort-controller'

import { isNodeJS, isReactNative } from './environment'

// TODO: we can't depend on @types/node-fetch because it depends on @types/node
// But it would be good to not have to define this type ourselves
type FetchResponse = {
  text(): Promise<string>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  json(): Promise<any>
  status: number
}

type FetchFunction = (
  url: string,
  init?: {
    method?: 'POST' | 'GET'
    body?: string
    headers?: { [key: string]: string }
    signal: AbortSignal
  }
) => Promise<FetchResponse>

let fetch: FetchFunction
let Headers
let Request
let Response

// NodeJS doesn't have fetch by default
if (isNodeJS()) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const nodeFetch = require('node-fetch')

  fetch = nodeFetch.default
  Headers = nodeFetch.Headers
  Request = nodeFetch.Request
  Response = nodeFetch.Response
} else if (isReactNative()) {
  // @ts-ignore
  fetch = global.fetch
  // @ts-ignore
  Headers = global.Headers
  // @ts-ignore
  Request = global.Request
  // @ts-ignore
  Response = global.Response
} else {
  // @ts-ignore
  fetch = window.fetch.bind(window)
  // @ts-ignore
  Headers = window.Headers
  // @ts-ignore
  Request = window.Request
  // @ts-ignore
  Response = window.Response
}

export { fetch, Headers, Request, Response }
