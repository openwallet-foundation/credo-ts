import type { MessagePickupProtocol } from './protocol/MessagePickupProtocol'
import type { QueuedMessage } from './storage'
import type { EncryptedMessage } from '../../types'

/**
 * Get the supported protocol versions based on the provided message pickup protocols
 */
export type MessagePickupProtocolVersionType<MPPs extends MessagePickupProtocol[]> = MPPs[number]['version']

export interface QueueMessageOptions {
  connectionId: string
  recipientKeys: string[]
  message: EncryptedMessage
}

export interface DeliverMessagesFromQueueOptions {
  pickupSessionId: string
  recipientKey?: string
  batchSize?: number
}

export interface DeliverMessagesOptions {
  pickupSessionId: string
  messages: QueuedMessage[]
}

export interface PickupMessagesOptions<MPPs extends MessagePickupProtocol[] = MessagePickupProtocol[]> {
  connectionId: string
  protocolVersion: MessagePickupProtocolVersionType<MPPs>
  recipientKey?: string
  batchSize?: number
}

export interface SetLiveDeliveryModeOptions<MPPs extends MessagePickupProtocol[] = MessagePickupProtocol[]> {
  connectionId: string
  protocolVersion: MessagePickupProtocolVersionType<MPPs>
  liveDelivery: boolean
}

export type QueueMessageReturnType = void

export type PickupMessagesReturnType = void

export type DeliverMessagesReturnType = void

export type SetLiveDeliveryModeReturnType = void
