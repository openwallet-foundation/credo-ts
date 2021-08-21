import 'react-native-get-random-values'
import '@azure/core-asynciterator-polyfill'

import type { AgentDependencies } from '@aries-framework/core'

import { Buffer } from 'buffer'
global.Buffer = global.Buffer || Buffer
import { EventEmitter } from 'events'
// Eslint complains indy-sdk-react-native has no default export
// But that's not true
// eslint-disable-next-line import/default
import indy from 'indy-sdk-react-native'

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
