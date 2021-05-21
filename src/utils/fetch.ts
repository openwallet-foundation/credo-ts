import { isNodeJS, isReactNative } from './environment'

let fetch
let Headers
let Request
let Response

// NodeJS doesn't have fetch by default
if (!fetch && isNodeJS()) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const nodeFetch = require('node-fetch')

  fetch = nodeFetch.default
  Headers = nodeFetch.Headers
  Request = nodeFetch.Request
  Response = nodeFetch.Response
} else if (!fetch && isReactNative()) {
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
