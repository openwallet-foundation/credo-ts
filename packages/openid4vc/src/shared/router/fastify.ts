import type { default as Fastify } from 'fastify'

export function importFastify() {
    try {
        const fastify = require('fastify') as typeof Fastify
        return fastify
    } catch (_error) {
        throw new Error('Fastify must be installed as a peer dependency')
    }
}
