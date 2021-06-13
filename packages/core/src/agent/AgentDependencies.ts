import type { FileSystem } from '../storage/FileSystem'
import type { EventEmitter as NativeEventEmitter } from 'events'
import type * as Indy from 'indy-sdk'
import type fetch from 'node-fetch'
import type WebSocket from 'ws'

export interface AgentDependencies {
  fileSystem: FileSystem
  indy: typeof Indy
  NativeEventEmitter: typeof NativeEventEmitter
  fetch: typeof fetch
  WebSocket: typeof WebSocket
}
