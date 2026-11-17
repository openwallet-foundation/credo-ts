import type WebSocket from 'ws'
import type { FileSystem } from '../storage/FileSystem'

/**
 * The part of an event emitter, such as the Node.js `EventEmitter`, that Credo uses.
 */
export interface EventEmitterLike {
  // biome-ignore lint/suspicious/noExplicitAny: matches the Node.js `EventEmitter`
  on(event: string, listener: (...args: any[]) => unknown): unknown
  // biome-ignore lint/suspicious/noExplicitAny: matches the Node.js `EventEmitter`
  off(event: string, listener: (...args: any[]) => unknown): unknown
  // biome-ignore lint/complexity/noBannedTypes: matches the Node.js `EventEmitter`
  listeners(event: string): Function[]
}

export interface AgentDependencies {
  FileSystem: {
    new (): FileSystem
  }
  EventEmitterClass: new () => EventEmitterLike
  fetch: typeof fetch
  WebSocketClass: typeof WebSocket
}
