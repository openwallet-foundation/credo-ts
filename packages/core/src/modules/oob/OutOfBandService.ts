import type { InboundMessageContext } from '../../agent/models/InboundMessageContext'
import type { Key } from '../../crypto'
import type { ConnectionRecord } from '../connections'
import type { HandshakeReusedEvent, OutOfBandStateChangedEvent } from './domain/OutOfBandEvents'
import type { OutOfBandRecord } from './repository'

import { scoped, Lifecycle } from 'tsyringe'

import { EventEmitter } from '../../agent/EventEmitter'
import { AriesFrameworkError } from '../../error'

import { OutOfBandEventTypes } from './domain/OutOfBandEvents'
import { OutOfBandRole } from './domain/OutOfBandRole'
import { OutOfBandState } from './domain/OutOfBandState'
import { HandshakeReuseMessage } from './messages'
import { HandshakeReuseAcceptedMessage } from './messages/HandshakeReuseAcceptedMessage'
import { OutOfBandRepository } from './repository'

@scoped(Lifecycle.ContainerScoped)
export class OutOfBandService {
  private outOfBandRepository: OutOfBandRepository
  private eventEmitter: EventEmitter

  public constructor(outOfBandRepository: OutOfBandRepository, eventEmitter: EventEmitter) {
    this.outOfBandRepository = outOfBandRepository
    this.eventEmitter = eventEmitter
  }

  public async processHandshakeReuse(messageContext: InboundMessageContext<HandshakeReuseMessage>) {
    const reuseMessage = messageContext.message
    const parentThreadId = reuseMessage.thread?.parentThreadId

    if (!parentThreadId) {
      throw new AriesFrameworkError('handshake-reuse message must have a parent thread id')
    }

    const outOfBandRecord = await this.findByInvitationId(parentThreadId)
    if (!outOfBandRecord) {
      throw new AriesFrameworkError('No out of band record found for handshake-reuse message')
    }

    // Assert
    outOfBandRecord.assertRole(OutOfBandRole.Sender)
    outOfBandRecord.assertState(OutOfBandState.AwaitResponse)

    const requestLength = outOfBandRecord.outOfBandInvitation.getRequests()?.length ?? 0
    if (requestLength > 0) {
      throw new AriesFrameworkError('Handshake reuse should only be used when no requests are present')
    }

    const reusedConnection = messageContext.assertReadyConnection()
    this.eventEmitter.emit<HandshakeReusedEvent>({
      type: OutOfBandEventTypes.HandshakeReused,
      payload: {
        reuseThreadId: reuseMessage.threadId,
        connectionRecord: reusedConnection,
        outOfBandRecord,
      },
    })

    // If the out of band record is not reusable we can set the state to done
    if (!outOfBandRecord.reusable) {
      await this.updateState(outOfBandRecord, OutOfBandState.Done)
    }

    const reuseAcceptedMessage = new HandshakeReuseAcceptedMessage({
      threadId: reuseMessage.threadId,
      parentThreadId,
    })

    return reuseAcceptedMessage
  }

  public async processHandshakeReuseAccepted(messageContext: InboundMessageContext<HandshakeReuseAcceptedMessage>) {
    const reuseAcceptedMessage = messageContext.message
    const parentThreadId = reuseAcceptedMessage.thread?.parentThreadId

    if (!parentThreadId) {
      throw new AriesFrameworkError('handshake-reuse-accepted message must have a parent thread id')
    }

    const outOfBandRecord = await this.findByInvitationId(parentThreadId)
    if (!outOfBandRecord) {
      throw new AriesFrameworkError('No out of band record found for handshake-reuse-accepted message')
    }

    // Assert
    outOfBandRecord.assertRole(OutOfBandRole.Receiver)
    outOfBandRecord.assertState(OutOfBandState.PrepareResponse)

    const reusedConnection = messageContext.assertReadyConnection()

    // Checks whether the connection associated with reuse accepted message matches with the connection
    // associated with the reuse message.
    // FIXME: not really a fan of the reuseConnectionId, but it's the only way I can think of now to get the connection
    // associated with the reuse message. Maybe we can at least move it to the metadata and remove it directly afterwards?
    // But this is an issue in general that has also come up for ACA-Py. How do I find the connection associated with an oob record?
    // Because it doesn't work really well with connection reuse.
    if (outOfBandRecord.reuseConnectionId !== reusedConnection.id) {
      throw new AriesFrameworkError('handshake-reuse-accepted is not in response to a handshake-reuse message.')
    }

    this.eventEmitter.emit<HandshakeReusedEvent>({
      type: OutOfBandEventTypes.HandshakeReused,
      payload: {
        reuseThreadId: reuseAcceptedMessage.threadId,
        connectionRecord: reusedConnection,
        outOfBandRecord,
      },
    })

    // receiver role is never reusable, so we can set the state to done
    await this.updateState(outOfBandRecord, OutOfBandState.Done)
  }

  public async createHandShakeReuse(outOfBandRecord: OutOfBandRecord, connectionRecord: ConnectionRecord) {
    const reuseMessage = new HandshakeReuseMessage({ parentThreadId: outOfBandRecord.outOfBandInvitation.id })

    // Store the reuse connection id
    outOfBandRecord.reuseConnectionId = connectionRecord.id
    await this.outOfBandRepository.update(outOfBandRecord)

    return reuseMessage
  }

  public async save(outOfBandRecord: OutOfBandRecord) {
    return this.outOfBandRepository.save(outOfBandRecord)
  }

  public async updateState(outOfBandRecord: OutOfBandRecord, newState: OutOfBandState) {
    const previousState = outOfBandRecord.state
    outOfBandRecord.state = newState
    await this.outOfBandRepository.update(outOfBandRecord)

    this.eventEmitter.emit<OutOfBandStateChangedEvent>({
      type: OutOfBandEventTypes.OutOfBandStateChanged,
      payload: {
        outOfBandRecord,
        previousState,
      },
    })
  }

  public async findById(outOfBandRecordId: string) {
    return this.outOfBandRepository.findById(outOfBandRecordId)
  }

  public async getById(outOfBandRecordId: string) {
    return this.outOfBandRepository.getById(outOfBandRecordId)
  }

  public async findByInvitationId(invitationId: string) {
    return this.outOfBandRepository.findSingleByQuery({ invitationId })
  }

  public async findByRecipientKey(recipientKey: Key) {
    return this.outOfBandRepository.findSingleByQuery({ recipientKeyFingerprints: [recipientKey.fingerprint] })
  }

  public async getAll() {
    return this.outOfBandRepository.getAll()
  }

  public async deleteById(outOfBandId: string) {
    const outOfBandRecord = await this.getById(outOfBandId)
    return this.outOfBandRepository.delete(outOfBandRecord)
  }
}
