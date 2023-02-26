import type { HandshakeReusedEvent, OutOfBandStateChangedEvent } from './domain/OutOfBandEvents'
import type { AgentContext } from '../../agent'
import type { InboundMessageContext } from '../../agent/models/InboundMessageContext'
import type { Key } from '../../crypto'
import type { Query } from '../../storage/StorageService'
import type { ConnectionRecord } from '../connections'
import type { HandshakeProtocol } from '../connections/models'

import { EventEmitter } from '../../agent/EventEmitter'
import { AriesFrameworkError } from '../../error'
import { injectable } from '../../plugins'
import { JsonTransformer } from '../../utils'
import { DidsApi } from '../dids'
import { parseDid } from '../dids/domain/parse'

import { OutOfBandEventTypes } from './domain/OutOfBandEvents'
import { OutOfBandRole } from './domain/OutOfBandRole'
import { OutOfBandState } from './domain/OutOfBandState'
import { HandshakeReuseMessage, OutOfBandInvitation } from './messages'
import { HandshakeReuseAcceptedMessage } from './messages/HandshakeReuseAcceptedMessage'
import { OutOfBandRecord, OutOfBandRepository } from './repository'

export interface CreateImplicitInvitationConfig {
  id: string
  did: string
  handshakeProtocols: HandshakeProtocol[]
  autoAcceptConnection: boolean
  recipientKey: Key
}

@injectable()
export class OutOfBandService {
  private outOfBandRepository: OutOfBandRepository
  private eventEmitter: EventEmitter

  public constructor(outOfBandRepository: OutOfBandRepository, eventEmitter: EventEmitter) {
    this.outOfBandRepository = outOfBandRepository
    this.eventEmitter = eventEmitter
  }

  public async createImplicitInvitation(
    agentContext: AgentContext,
    config: CreateImplicitInvitationConfig
  ): Promise<OutOfBandRecord> {
    const { id, did, handshakeProtocols, autoAcceptConnection, recipientKey } = config

    // Verify it is a valid did and it is present in the wallet
    const publicDid = parseDid(did)
    if (!(await agentContext.dependencyManager.resolve(DidsApi).getCreatedDids({ did: publicDid.did }))) {
      throw new AriesFrameworkError(`Referenced public did ${did} not found.`)
    }

    const outOfBandInvitation = new OutOfBandInvitation({
      id,
      label: '',
      services: [did],
      handshakeProtocols,
    })

    const outOfBandRecord = new OutOfBandRecord({
      role: OutOfBandRole.Sender,
      state: OutOfBandState.AwaitResponse,
      reusable: true,
      autoAcceptConnection,
      isImplicitInvitation: true,
      outOfBandInvitation,
      tags: {
        recipientKeyFingerprints: [recipientKey.fingerprint],
      },
    })

    await this.save(agentContext, outOfBandRecord)
    this.emitStateChangedEvent(agentContext, outOfBandRecord, null)
    return outOfBandRecord
  }

  public async processHandshakeReuse(messageContext: InboundMessageContext<HandshakeReuseMessage>) {
    const reuseMessage = messageContext.message
    const parentThreadId = reuseMessage.thread?.parentThreadId

    if (!parentThreadId) {
      throw new AriesFrameworkError('handshake-reuse message must have a parent thread id')
    }

    const outOfBandRecord = await this.findByCreatedInvitationId(messageContext.agentContext, parentThreadId)
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
    this.eventEmitter.emit<HandshakeReusedEvent>(messageContext.agentContext, {
      type: OutOfBandEventTypes.HandshakeReused,
      payload: {
        reuseThreadId: reuseMessage.threadId,
        connectionRecord: reusedConnection,
        outOfBandRecord,
      },
    })

    // If the out of band record is not reusable we can set the state to done
    if (!outOfBandRecord.reusable) {
      await this.updateState(messageContext.agentContext, outOfBandRecord, OutOfBandState.Done)
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

    const outOfBandRecord = await this.findByReceivedInvitationId(messageContext.agentContext, parentThreadId)
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

    this.eventEmitter.emit<HandshakeReusedEvent>(messageContext.agentContext, {
      type: OutOfBandEventTypes.HandshakeReused,
      payload: {
        reuseThreadId: reuseAcceptedMessage.threadId,
        connectionRecord: reusedConnection,
        outOfBandRecord,
      },
    })

    // receiver role is never reusable, so we can set the state to done
    await this.updateState(messageContext.agentContext, outOfBandRecord, OutOfBandState.Done)
  }

  public async createHandShakeReuse(
    agentContext: AgentContext,
    outOfBandRecord: OutOfBandRecord,
    connectionRecord: ConnectionRecord
  ) {
    const reuseMessage = new HandshakeReuseMessage({ parentThreadId: outOfBandRecord.outOfBandInvitation.id })

    // Store the reuse connection id
    outOfBandRecord.reuseConnectionId = connectionRecord.id
    await this.outOfBandRepository.update(agentContext, outOfBandRecord)

    return reuseMessage
  }

  public async save(agentContext: AgentContext, outOfBandRecord: OutOfBandRecord) {
    return this.outOfBandRepository.save(agentContext, outOfBandRecord)
  }

  public async updateState(agentContext: AgentContext, outOfBandRecord: OutOfBandRecord, newState: OutOfBandState) {
    const previousState = outOfBandRecord.state
    outOfBandRecord.state = newState
    await this.outOfBandRepository.update(agentContext, outOfBandRecord)

    this.emitStateChangedEvent(agentContext, outOfBandRecord, previousState)
  }

  public emitStateChangedEvent(
    agentContext: AgentContext,
    outOfBandRecord: OutOfBandRecord,
    previousState: OutOfBandState | null
  ) {
    const clonedOutOfBandRecord = JsonTransformer.clone(outOfBandRecord)

    this.eventEmitter.emit<OutOfBandStateChangedEvent>(agentContext, {
      type: OutOfBandEventTypes.OutOfBandStateChanged,
      payload: {
        outOfBandRecord: clonedOutOfBandRecord,
        previousState,
      },
    })
  }

  public async findById(agentContext: AgentContext, outOfBandRecordId: string) {
    return this.outOfBandRepository.findById(agentContext, outOfBandRecordId)
  }

  public async getById(agentContext: AgentContext, outOfBandRecordId: string) {
    return this.outOfBandRepository.getById(agentContext, outOfBandRecordId)
  }

  public async findByReceivedInvitationId(agentContext: AgentContext, receivedInvitationId: string) {
    return this.outOfBandRepository.findSingleByQuery(agentContext, {
      invitationId: receivedInvitationId,
      role: OutOfBandRole.Receiver,
    })
  }

  public async findByCreatedInvitationId(agentContext: AgentContext, createdInvitationId: string) {
    return this.outOfBandRepository.findSingleByQuery(agentContext, {
      invitationId: createdInvitationId,
      role: OutOfBandRole.Sender,
    })
  }

  public async findCreatedByRecipientKey(agentContext: AgentContext, recipientKey: Key) {
    return this.outOfBandRepository.findSingleByQuery(agentContext, {
      recipientKeyFingerprints: [recipientKey.fingerprint],
      role: OutOfBandRole.Sender,
    })
  }

  public async getAll(agentContext: AgentContext) {
    return this.outOfBandRepository.getAll(agentContext)
  }

  public async findAllByQuery(agentContext: AgentContext, query: Query<OutOfBandRecord>) {
    return this.outOfBandRepository.findByQuery(agentContext, query)
  }

  public async deleteById(agentContext: AgentContext, outOfBandId: string) {
    const outOfBandRecord = await this.getById(agentContext, outOfBandId)
    return this.outOfBandRepository.delete(agentContext, outOfBandRecord)
  }
}
