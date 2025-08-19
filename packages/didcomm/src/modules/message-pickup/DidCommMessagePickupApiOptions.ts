import type { QueuedDidCommMessage } from '../../transport/queue'
import type { EncryptedDidCommMessage } from '../../types'
import type { DidCommMessagePickupProtocol } from './protocol/DidCommMessagePickupProtocol'

/**
 * Get the supported protocol versions based on the provided message pickup protocols
 */
export type DidCommMessagePickupProtocolVersionType<MPPs extends DidCommMessagePickupProtocol[]> =
  MPPs[number]['version']

export interface QueueMessageOptions {
  connectionId: string
  recipientDids: string[]
  message: EncryptedDidCommMessage
}

export interface DeliverMessagesFromQueueOptions {
  pickupSessionId: string
  recipientDid?: string
  batchSize?: number
}

export interface DeliverMessagesOptions {
  pickupSessionId: string
  messages: QueuedDidCommMessage[]
}

export interface PickupMessagesOptions<MPPs extends DidCommMessagePickupProtocol[] = DidCommMessagePickupProtocol[]> {
  connectionId: string
  protocolVersion: DidCommMessagePickupProtocolVersionType<MPPs>
  recipientDid?: string
  batchSize?: number
  awaitCompletion?: boolean
  awaitCompletionTimeoutMs?: number
}

export interface SetLiveDeliveryModeOptions<
  MPPs extends DidCommMessagePickupProtocol[] = DidCommMessagePickupProtocol[],
> {
  connectionId: string
  protocolVersion: DidCommMessagePickupProtocolVersionType<MPPs>
  liveDelivery: boolean
}

export type QueueMessageReturnType = undefined

export type PickupMessagesReturnType = undefined

export type DeliverMessagesReturnType = undefined

export type DeliverMessagesFromQueueReturnType = undefined

export type SetLiveDeliveryModeReturnType = undefined
