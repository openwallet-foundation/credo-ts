import express from 'express'
import { createProxyMiddleware } from 'http-proxy-middleware'
import selfsigned from 'selfsigned'
import https, { globalAgent } from 'https'
import { setGlobalDispatcher, Agent, getGlobalDispatcher } from 'undici'
import { agentDependencies } from '@credo-ts/node'

export function disableSslVerification() {

  const originalDispatcher = getGlobalDispatcher()
  // Works for global fetch (undici)
  const dispatcher = new Agent({
    connect: {
      rejectUnauthorized: false,
    },
  })
  const originalFetch = fetch
  global.fetch = (url, options) =>
    // @ts-ignore
    originalFetch(url, {
      ...options,
      dispatcher,
    })
  agentDependencies.fetch = global.fetch
  setGlobalDispatcher(dispatcher)

  // We use a self-signed certificate and so we need to disable invalid ssl certificates
  // Works for node-fetch (cross-fetch)
  globalAgent.options.rejectUnauthorized = false

  return () => {
    global.fetch = originalFetch
    agentDependencies.fetch = originalFetch
    setGlobalDispatcher(originalDispatcher)
    globalAgent.options.rejectUnauthorized = true
  }
}

export function createHttpsProxy({ target, port }: { target: string; port: number }) {
  // Generate certificates on the fly
  const attrs = [{ name: 'commonName', value: `localhost:${port}` }]
  const pems = selfsigned.generate(attrs, {
    algorithm: 'sha256',
    days: 30,
    keySize: 2048,
  })

  const app = express()

  // Configure proxy middleware
  const proxy = createProxyMiddleware({
    target,
    changeOrigin: true,
    secure: false,
  })

  // Use proxy for all routes
  app.use(proxy)

  const server = https
    .createServer(
      {
        key: pems.private,
        cert: pems.cert,
      },
      app
    )
    .listen(port)

  return server
}
