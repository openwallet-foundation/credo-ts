import type { Logger } from '../../../logger'
import type { ConnectionRecord, Routing } from '../../connections'
import type { Transport } from '../../routing/types'
import type { OutOfBandEventStateChangedEvent } from '../OutOfBandEvents'

import { inject, Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from '../../../agent/AgentConfig'
import { EventEmitter } from '../../../agent/EventEmitter'
import { InjectionSymbols } from '../../../constants'
import { AriesFrameworkError } from '../../../error'
import { Wallet } from '../../../wallet/Wallet'
import { ConnectionRole, ConnectionService, ConnectionState } from '../../connections'
import { DidResolverService } from '../../dids'
import { DidService } from '../../dids/services/DidService'
import { defaultAcceptProfiles } from '../../routing/types'
import { OutOfBandEventTypes } from '../OutOfBandEvents'
import { OutOfBandRole } from '../OutOfBandRole'
import { OutOfBandState } from '../OutOfBandState'
import { OutOfBandInvitationMessage } from '../messages/OutOfBandInvitationMessage'
import { OutOfBandRecord, OutOfBandRepository } from '../repository'

@scoped(Lifecycle.ContainerScoped)
export class OutOfBandService {
  private wallet: Wallet
  private config: AgentConfig
  private outOfBandRepository: OutOfBandRepository
  private eventEmitter: EventEmitter
  private logger: Logger
  private didService: DidService
  private didResolverService: DidResolverService
  private connectionService: ConnectionService

  public constructor(
    @inject(InjectionSymbols.Wallet) wallet: Wallet,
    config: AgentConfig,
    outOfBandRepository: OutOfBandRepository,
    eventEmitter: EventEmitter,
    didService: DidService,
    didResolverService: DidResolverService,
    connectionService: ConnectionService
  ) {
    this.wallet = wallet
    this.config = config
    this.outOfBandRepository = outOfBandRepository
    this.eventEmitter = eventEmitter
    this.logger = config.logger
    this.didService = didService
    this.didResolverService = didResolverService
    this.connectionService = connectionService
  }

  /**
   * Create a new Out-Of-Band connection
   *
   * @param config config for creation of connection and invitation
   * @returns new connection record
   */
  public async createOutOfBandInvitation(config: {
    goalCode?: string
    alias?: string
    myLabel?: string
    myImageUrl?: string
    autoAcceptConnection?: boolean
    multiUseInvitation?: boolean
    routing: Routing
    transport?: Transport
  }): Promise<{ outOfBandRecord: OutOfBandRecord; message: OutOfBandInvitationMessage }> {
    const connectionRecord = await this.connectionService.createConnection({
      role: ConnectionRole.Inviter,
      state: ConnectionState.Complete,
      alias: config?.alias,
      routing: config.routing,
      autoAcceptConnection: config?.autoAcceptConnection,
      multiUseInvitation: config.multiUseInvitation ?? false,
      transport: config?.transport,
    })
    const invitation = new OutOfBandInvitationMessage({
      from: connectionRecord.didDoc.id,
      body: {
        label: config?.myLabel ?? this.config.label,
        goalCode: config?.goalCode,
        accept: defaultAcceptProfiles,
        imageUrl: config?.myImageUrl ?? this.config.connectionImageUrl,
      },
    })

    const outOfBandRecord = new OutOfBandRecord({
      invitation,
      role: OutOfBandRole.Sender,
      state: OutOfBandState.Completed,
    })

    connectionRecord.outOfBandInvitation = invitation

    await this.connectionService.update(connectionRecord)
    await this.outOfBandRepository.save(outOfBandRecord)

    this.eventEmitter.emit<OutOfBandEventStateChangedEvent>({
      type: OutOfBandEventTypes.OutOfBandStateChanged,
      payload: {
        outOfBandRecord,
        previousState: null,
      },
    })

    return { outOfBandRecord, message: invitation }
  }

  public async receiveOutOfBandInvitation(
    invitation: OutOfBandInvitationMessage
  ): Promise<{ outOfBandRecord: OutOfBandRecord }> {
    const outOfBandRecord = new OutOfBandRecord({
      invitation,
      role: OutOfBandRole.Receiver,
      state: OutOfBandState.Received,
    })

    await this.outOfBandRepository.save(outOfBandRecord)

    this.eventEmitter.emit<OutOfBandEventStateChangedEvent>({
      type: OutOfBandEventTypes.OutOfBandStateChanged,
      payload: {
        outOfBandRecord,
        previousState: null,
      },
    })

    return { outOfBandRecord }
  }

  public async makeOutOfBandConnection(
    invitation: OutOfBandInvitationMessage,
    outOfBandRecord: OutOfBandRecord,
    config: {
      alias?: string
      routing: Routing
      transport?: Transport
    }
  ): Promise<{ outOfBandRecord: OutOfBandRecord; connectionRecord: ConnectionRecord }> {
    if (!invitation.from) {
      throw new AriesFrameworkError(`Invalid Out-Of-Band invitation: 'from' field is missing`)
    }

    const connectionRecord = await this.connectionService.createConnection({
      role: ConnectionRole.Invitee,
      state: ConnectionState.Complete,
      alias: config?.alias,
      outOfBandInvitation: invitation,
      theirLabel: invitation.body?.label,
      routing: config.routing,
      imageUrl: invitation.body?.imageUrl,
      multiUseInvitation: false,
      transport: config.transport,
    })

    await this.connectionService.setConnectionTheirInfo(connectionRecord, invitation.from)

    await this.updateState(outOfBandRecord, OutOfBandState.Connected)

    return { outOfBandRecord, connectionRecord }
  }

  public async complete(outOfBandRecord: OutOfBandRecord): Promise<{ outOfBandRecord: OutOfBandRecord }> {
    await this.updateState(outOfBandRecord, OutOfBandState.Completed)
    return { outOfBandRecord }
  }

  public async updateState(outOfBandRecord: OutOfBandRecord, newState: OutOfBandState) {
    const previousState = outOfBandRecord.state
    outOfBandRecord.state = newState
    await this.outOfBandRepository.update(outOfBandRecord)

    this.eventEmitter.emit<OutOfBandEventStateChangedEvent>({
      type: OutOfBandEventTypes.OutOfBandStateChanged,
      payload: {
        outOfBandRecord: outOfBandRecord,
        previousState,
      },
    })
  }

  public getById(recordId: string): Promise<OutOfBandRecord> {
    return this.outOfBandRepository.getById(recordId)
  }
}
