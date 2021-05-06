import { isNodeJS } from './environment'

// RN exposes global fetch
let fetch = global.fetch
let Headers = global.Headers
let Request = global.Request
let Response = global.Response

// NodeJS doesn't have fetch by default
if (!fetch && isNodeJS()) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const nodeFetch = require('node-fetch')

  fetch = nodeFetch.default
  Headers = nodeFetch.Headers
  Request = nodeFetch.Request
  Response = nodeFetch.Response
}

export { fetch, Headers, Request, Response }
