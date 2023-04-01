import type { MessagePickupProtocol } from './protocol/MessagePickupProtocol'
import type { EncryptedMessage } from '../../types'

/**
 * Get the supported protocol versions based on the provided discover features services.
 */
export type MessagePickupProtocolVersionType<MPPs extends MessagePickupProtocol[]> = MPPs[number]['version']

export interface QueueMessageOptions {
  connectionId: string
  message: EncryptedMessage
}

export interface PickupMessagesOptions<MPPs extends MessagePickupProtocol[] = MessagePickupProtocol[]> {
  connectionId: string
  protocolVersion: MessagePickupProtocolVersionType<MPPs>
  recipientKey?: string
  batchSize?: number
}

export type QueueMessageReturnType = void

export type PickupMessagesReturnType = void
