/* eslint-disable @typescript-eslint/ban-ts-comment */
import type Fetch from 'node-fetch'

import { isNodeJS, isReactNative } from './environment'

let fetch: typeof Fetch
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
