import 'react-native-get-random-values'
import '@azure/core-asynciterator-polyfill'

import type { AgentDependencies } from '@credo-ts/core'

import { EventEmitter } from 'events'

import { ReactNativeFileSystem } from './ReactNativeFileSystem'

export { SecureEnvironmentKeyManagementService } from './kms/SecureEnvironmentKeyManagementService'

const fetch = global.fetch as unknown as AgentDependencies['fetch']
const WebSocket = global.WebSocket as unknown as AgentDependencies['WebSocketClass']

const agentDependencies: AgentDependencies = {
  FileSystem: ReactNativeFileSystem,
  fetch,
  EventEmitterClass: EventEmitter,
  WebSocketClass: WebSocket,
}

export { agentDependencies }
