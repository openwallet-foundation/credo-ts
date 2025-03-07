import type { Router } from 'express'
import type { FastifyInstance } from 'fastify'

export interface RouterFactory<RouterType extends Router | FastifyInstance> {
  create(): RouterType
}
