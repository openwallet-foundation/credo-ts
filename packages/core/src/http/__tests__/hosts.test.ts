import { describe, expect, it } from 'vitest'
import { createFetchHandler, createUniversalMiddleware, createWebSocketResolver } from '..'
import { HttpRouter } from '../HttpRouter'

// The global Request type is React Native's in this monorepo, the constructor is undici's
const request = (path: string, method = 'GET') => new Request(`http://localhost${path}`, { method }) as Request

const helloRoute = {
  method: 'GET' as const,
  path: '/hello/:name',
  handler: (_request: Request, { params }: { params: Record<string, string> }) => new Response(`hello ${params.name}`),
}

describe('HTTP hosts', () => {
  it('routes requests to the matching route, with its path params', async () => {
    const router = new HttpRouter()
    router.addRoute(helloRoute)

    const response = await createFetchHandler(router)(request('/hello/credo'))
    expect(await response.text()).toBe('hello credo')
  })

  it('answers requests no route matches with the fallback, or 404', async () => {
    const router = new HttpRouter()
    router.addRoute(helloRoute)

    expect((await createFetchHandler(router)(request('/other'))).status).toBe(404)
    expect((await createFetchHandler(router)(request('/hello/credo', 'POST'))).status).toBe(404)
    expect(
      (await createFetchHandler(router, () => new Response(null, { status: 204 }))(request('/other'))).status
    ).toBe(204)
  })

  it('matches routes added or removed after the host was set up', async () => {
    const router = new HttpRouter()
    const middleware = createUniversalMiddleware(router)
    const runtime = () => ({ runtime: 'other', adapter: 'other', params: undefined }) as const

    expect(await middleware(request('/hello/credo'), {}, runtime())).toBeUndefined()

    router.addRoute(helloRoute)
    expect(await middleware(request('/hello/credo'), {}, runtime())).toBeInstanceOf(Response)

    router.removeRoute(helloRoute)
    expect(await middleware(request('/hello/credo'), {}, runtime())).toBeUndefined()
  })

  it('resolves the WebSocket route of an upgrade request', () => {
    const router = new HttpRouter()
    const route = { path: '/ws' }
    router.addWebSocketRoute(route)

    const resolveRoute = createWebSocketResolver(router)
    expect(resolveRoute(request('/ws'))).toBe(route)
    expect(resolveRoute(request('/other'))).toBeUndefined()
  })
})

describe('HttpRouter.assertHosted', () => {
  it('fails when no host serves a kind of route the modules added', async () => {
    const router = new HttpRouter()
    router.addHost({ http: () => {} })
    router.addRoute(helloRoute)
    await expect(router.assertHosted()).resolves.toBeUndefined()

    router.addWebSocketRoute({ path: '/ws' })
    await expect(router.assertHosted()).rejects.toThrow('no host serves WebSockets')
  })

  it('fails when setting up a host failed', async () => {
    const router = new HttpRouter()
    router.addHost({ http: async () => Promise.reject(new Error('apply failed')) })

    await expect(router.assertHosted()).rejects.toThrow('Setting up an HTTP host failed')
  })
})
