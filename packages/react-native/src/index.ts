import type { AgentDependencies } from '@aries-framework/core'

import { EventEmitter } from 'events'
import * as indy from 'rn-indy-sdk'

import { ReactNativeFileSystem } from './ReactNativeFileSystem'

const fetch = global.fetch as unknown as AgentDependencies['fetch']
const WebSocket = global.WebSocket as unknown as AgentDependencies['WebSocket']

const agentDependencies: AgentDependencies = {
  FileSystem: ReactNativeFileSystem,
  fetch,
  NativeEventEmitter: EventEmitter,
  WebSocket,
  indy,
}

export { agentDependencies }
