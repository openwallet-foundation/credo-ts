import type { default as Fastify, FastifyInstance } from 'fastify'
import { RouterFactory } from './RouterFactory'

export function importFastify() {
  try {
    const fastify = require('fastify') as typeof Fastify
    return fastify
  } catch (_error) {
    throw new Error('Fastify must be installed as a peer dependency')
  }
}

export class FastifyRouterFactory implements RouterFactory<FastifyInstance> {
  public create() {
    return importFastify()()
  }
}
