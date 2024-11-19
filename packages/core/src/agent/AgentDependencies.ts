import type { FileSystem } from '../storage/FileSystem'
import type { EventEmitter } from 'events'
// eslint-disable-next-line import/no-named-as-default
import type WebSocket from 'ws'

export interface AgentDependencies {
  FileSystem: {
    new (): FileSystem
  }
  EventEmitterClass: typeof EventEmitter
  fetch: typeof fetch
  WebSocketClass: typeof WebSocket
}
