import { EventEmitter } from 'node:events'
import type { AgentContext } from '@credo-ts/core'
import type { Request, Response } from 'express'
import { endRequestSession, registerRequestSession } from '../router/context'

describe('registerRequestSession', () => {
  test('hands waitUntil a promise during the request that settles once the session has ended', async () => {
    const waitUntil = vi.fn()
    const endSession = vi.fn(async () => {})
    const agentContext = { config: { waitUntil }, endSession } as unknown as AgentContext
    const request = {} as Request

    registerRequestSession(request, new EventEmitter() as unknown as Response, agentContext)

    expect(waitUntil).toHaveBeenCalledOnce()
    let settled = false
    const sessionEnded = waitUntil.mock.calls[0][0].then(() => {
      settled = true
    })
    await new Promise((resolve) => setImmediate(resolve))
    expect(settled).toBe(false)

    await endRequestSession(request)
    await sessionEnded
    expect(endSession).toHaveBeenCalledOnce()
  })
})
