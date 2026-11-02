import type { EventEmitter } from 'events'
import type { FileSystem } from '../storage/FileSystem'
import type { WebSocketConstructor } from '../websocket'

export interface AgentDependencies {
  FileSystem: {
    new (): FileSystem
  }
  EventEmitterClass: typeof EventEmitter
  fetch: typeof fetch
  WebSocketClass: WebSocketConstructor
}
