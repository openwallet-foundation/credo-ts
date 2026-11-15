import 'react-native-get-random-values'
import './subtleDigest'

import type { AgentDependencies } from '@credo-ts/core'

import { EventEmitter } from 'events'

import { ReactNativeFileSystem } from './ReactNativeFileSystem'

export {
  type SecureEnvironmentCreateKeyOptions,
  SecureEnvironmentKeyManagementService,
  type SecureEnvironmentKeyManagementServiceOptions,
  type SecureEnvironmentUserAuthenticationOptions,
} from './kms/SecureEnvironmentKeyManagementService'

const fetch = global.fetch as unknown as AgentDependencies['fetch']
const WebSocket = global.WebSocket as unknown as AgentDependencies['WebSocketClass']

const agentDependencies: AgentDependencies = {
  FileSystem: ReactNativeFileSystem,
  fetch,
  EventEmitterClass: EventEmitter,
  WebSocketClass: WebSocket,
}

export { agentDependencies }
