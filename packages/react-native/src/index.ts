import 'react-native-get-random-values'
import '@azure/core-asynciterator-polyfill'

import type { AgentDependencies } from '@aries-framework/core'

import { EventEmitter } from 'events'
// Eslint complains rn-indy-sdk has no default export
// But that's not true
// eslint-disable-next-line import/default
import indy from 'rn-indy-sdk'

import { ReactNativeFileSystem } from './ReactNativeFileSystem'

const fetch = global.fetch as unknown as AgentDependencies['fetch']
const WebSocket = global.WebSocket as unknown as AgentDependencies['WebSocketClass']

const agentDependencies: AgentDependencies = {
  FileSystem: ReactNativeFileSystem,
  fetch,
  EventEmitterClass: EventEmitter,
  WebSocketClass: WebSocket,
  indy,
}

export { agentDependencies }
