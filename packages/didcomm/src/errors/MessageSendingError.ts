import { CredoError } from '@credo-ts/core'
import type { DidCommOutboundMessageContext } from '../models'

export enum MessageSendingErrorCategory {
  /** An expected state: the recipient has no reachable endpoint and no usable queue, or closed its session. */
  RecipientUnreachable = 'RecipientUnreachable',
  /** Delivery failed on the recipient's side: an endpoint failed, or their DID document has no usable service. */
  RemoteError = 'RemoteError',
  /** Our side is wrong: configuration, keys, packing, or a session that was already used for another message. */
  InternalError = 'InternalError',
}

export enum MessageSendingSessionResult {
  /** The session of the inbound message no longer exists, and the connection has no session that can take over. */
  NotFound = 'NotFound',
  /** The session of the inbound message was already closed or answered. */
  Closed = 'Closed',
  /** Sending over the session failed. */
  Failed = 'Failed',
  /** The message could not be prepared for the session. */
  InternalError = 'InternalError',
}

export enum MessageSendingServiceResult {
  /** The endpoint failed, or no outbound transport supports its scheme. */
  TransportError = 'TransportError',
  /** The message could not be prepared, or there is no outbound transport at all. */
  InternalError = 'InternalError',
}

export enum MessageSendingQueueResult {
  /** The recipient has no queue for message pickup. */
  NotAvailable = 'NotAvailable',
  /** The message type cannot be queued. */
  MessageNotQueueable = 'MessageNotQueueable',
}

export type MessageSendingAttempt =
  | { type: 'session'; sessionId: string; result: MessageSendingSessionResult; error?: Error }
  | { type: 'service'; serviceId: string; endpoint: string; result: MessageSendingServiceResult; error: Error }
  | { type: 'queue'; result: MessageSendingQueueResult }

export interface MessageSendingErrorReason {
  category: MessageSendingErrorCategory
  /** What was tried, in order. Empty when sending failed before the first attempt. */
  attempts: MessageSendingAttempt[]
}

export class MessageSendingError extends CredoError {
  public outboundMessageContext: DidCommOutboundMessageContext
  public reason: MessageSendingErrorReason

  public constructor(
    message: string,
    {
      outboundMessageContext,
      reason,
      cause,
    }: { outboundMessageContext: DidCommOutboundMessageContext; reason: MessageSendingErrorReason; cause?: Error }
  ) {
    super(message, { cause })
    this.outboundMessageContext = outboundMessageContext
    this.reason = reason
  }
}

export function categorizeMessageSendingAttempts(attempts: MessageSendingAttempt[]): MessageSendingErrorCategory {
  const sessionResults = attempts.flatMap((a) => (a.type === 'session' ? [a.result] : []))
  const serviceResults = attempts.flatMap((a) => (a.type === 'service' ? [a.result] : []))

  // A closed session counts as ours: only the reply to its inbound message is sent to a session by id,
  // so something else answered on it first.
  if (
    sessionResults.includes(MessageSendingSessionResult.InternalError) ||
    sessionResults.includes(MessageSendingSessionResult.Closed) ||
    serviceResults.includes(MessageSendingServiceResult.InternalError)
  ) {
    return MessageSendingErrorCategory.InternalError
  }
  if (
    sessionResults.includes(MessageSendingSessionResult.Failed) ||
    serviceResults.includes(MessageSendingServiceResult.TransportError)
  ) {
    return MessageSendingErrorCategory.RemoteError
  }
  return MessageSendingErrorCategory.RecipientUnreachable
}

export function describeMessageSendingAttempt(attempt: MessageSendingAttempt): string {
  switch (attempt.type) {
    case 'session':
      if (attempt.result === MessageSendingSessionResult.NotFound) {
        return `Transport session ${attempt.sessionId} no longer exists`
      }
      if (attempt.result === MessageSendingSessionResult.Closed) {
        return `Transport session ${attempt.sessionId} is already closed`
      }
      return `Transport session ${attempt.sessionId}: ${attempt.error?.message}`
    case 'service':
      return `Service ${attempt.endpoint}: ${attempt.error.message}`
    case 'queue':
      return attempt.result === MessageSendingQueueResult.NotAvailable
        ? 'Recipient has no queue for message pickup'
        : 'Message type cannot be queued for message pickup'
  }
}
