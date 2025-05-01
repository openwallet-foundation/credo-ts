import type { default as Fastify, FastifyInstance } from 'fastify'
import { RouterFactory } from './RouterFactory'

export function importFastify() {
  try {
    return require('fastify') as typeof Fastify
  } catch (_error) {
    throw new Error('Fastify must be installed as a peer dependency')
  }
}

export class FastifyRouterFactory implements RouterFactory<FastifyInstance> {
  public create() {
    return importFastify()()
  }
}
