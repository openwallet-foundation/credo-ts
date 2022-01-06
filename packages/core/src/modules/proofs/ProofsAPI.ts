import type { PresentationExchangeRecord, PresentationRecordBinding } from './PresentationExchangeRecord'
import type { ProofService } from './ProofService'
import type { ProofRecord } from './repository'
import type { ProposeProofOptions } from './v2/interface'

import { Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from '../../agent/AgentConfig'
import { Dispatcher } from '../../agent/Dispatcher'
import { EventEmitter } from '../../agent/EventEmitter'
import { MessageSender } from '../../agent/MessageSender'
import { createOutboundMessage } from '../../agent/helpers'
import { ConnectionService } from '../connections/services/ConnectionService'
import { MediationRecipientService } from '../routing'

import { PresentationRecordType } from './PresentationExchangeRecord'
import { ProofProtocolVersion } from './ProofProtocolVersion'
import { ProofResponseCoordinator } from './ProofResponseCoordinator'
import { ProofState } from './ProofState'
import { ProofsModule } from './ProofsModule'
import { ProofRepository } from './repository'
import { V1LegacyProofService } from './v1/V1LegacyProofService'
import { V1ProofService } from './v1/V1ProofService'
import { ProofRole } from './v2/ProofRole'
import { V2ProofService } from './v2/V2ProofService'

export interface ProofsAPI {
  proposeProof(proofOptions: ProposeProofOptions): Promise<PresentationExchangeRecord>
  getById(proofRecordId: string): Promise<ProofRecord>
}

type Tag = string | boolean | number

@scoped(Lifecycle.ContainerScoped)
export class ProofsAPI extends ProofsModule implements ProofsAPI {
  private connService: ConnectionService
  private msgSender: MessageSender
  private v1ProofService: V1LegacyProofService
  private proofRepository: ProofRepository
  private eventEmitter: EventEmitter
  private dispatcher: Dispatcher
  private agntConfig: AgentConfig
  private proofResponseCoord: ProofResponseCoordinator
  private v1Service: V1ProofService
  private v2Service: V2ProofService
  private serviceMap: { '1.0': V1ProofService; '2.0': V2ProofService }

  public constructor(
    dispatcher: Dispatcher,
    messageSender: MessageSender,
    connectionService: ConnectionService,
    agentConfig: AgentConfig,
    proofResponseCoordinator: ProofResponseCoordinator,
    mediationRecipientService: MediationRecipientService,
    v1ProofService: V1LegacyProofService,
    proofRepository: ProofRepository,
    eventEmitter: EventEmitter
  ) {
    super(
      dispatcher,
      connectionService,
      v1ProofService,
      messageSender,
      agentConfig,
      proofResponseCoordinator,
      mediationRecipientService
    )
    this.msgSender = messageSender
    this.v1ProofService = v1ProofService
    this.connService = connectionService
    this.proofRepository = proofRepository
    this.eventEmitter = eventEmitter
    this.dispatcher = dispatcher
    this.agntConfig = agentConfig
    this.proofResponseCoord = proofResponseCoordinator
    this.v1Service = new V1ProofService(this.v1ProofService, this.connService)
    this.v2Service = new V2ProofService(
      this.proofRepository,
      this.connService,
      this.eventEmitter,
      this.agntConfig,
      this.dispatcher,
      this.proofResponseCoord
    )

    this.serviceMap = {
      [ProofProtocolVersion.V1_0]: this.v1Service,
      [ProofProtocolVersion.V2_0]: this.v2Service,
    }

    this.v2Service.registerHandlers()
  }

  public getService(protocolVersion: ProofProtocolVersion) {
    return this.serviceMap[protocolVersion]
  }

  public async proposeProof(proofOptions: ProposeProofOptions): Promise<PresentationExchangeRecord> {
    const version: ProofProtocolVersion = proofOptions.protocolVersion

    const service: ProofService = this.getService(version)

    const connection = await this.connService.getById(proofOptions.connectionId)

    const { proofRecord, message } = await service.createProposal(proofOptions)

    const outbound = createOutboundMessage(connection, message)

    await this.msgSender.sendMessage(outbound)

    const recordBinding: PresentationRecordBinding = {
      presentationRecordType: proofOptions.proofFormats?.indy
        ? PresentationRecordType.INDY
        : PresentationRecordType.W3C,
      presentationRecordId: proofRecord.id,
    }

    const bindings: PresentationRecordBinding[] = []
    bindings.push(recordBinding)

    const presentationExchangeRecord: PresentationExchangeRecord = {
      ...proofRecord,
      protocolVersion: version,
      state: ProofState.ProposalSent,
      role: ProofRole.Prover,
      presentation: bindings,
    }

    return presentationExchangeRecord
  }
}
