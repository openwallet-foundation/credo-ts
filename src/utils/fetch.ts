import { isNodeJS, isReactNative } from './environment'

type Fetch = {
  (input: RequestInfo, init?: RequestInit): Promise<Response>
}

let fetch: Fetch
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
  fetch = global.fetch
  Headers = global.Headers
  Request = global.Request
  Response = global.Response
} else {
  fetch = window.fetch.bind(window)
  Headers = window.Headers
  Request = window.Request
  Response = window.Response
}

export { fetch, Headers, Request, Response }
