import type { EventEmitter } from 'events'
import type WebSocket from 'ws'
import type { FileSystem } from '../storage/FileSystem'

export interface AgentDependencies {
  FileSystem: {
    new (): FileSystem
  }
  EventEmitterClass: typeof EventEmitter
  fetch: typeof fetch
  WebSocketClass: typeof WebSocket
}
