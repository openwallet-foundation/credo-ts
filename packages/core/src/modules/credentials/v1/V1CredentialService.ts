
import { AgentMessage, MessageSender } from '@aries-framework/core'
import { CredentialService } from '../CredentialService'
import { ProposeCredentialOptions } from '../v2/interfaces'
import { CredentialPreview } from '../CredentialPreview'
import { CredentialProposeOptions, V1LegacyCredentialService } from '.'
import { ConnectionService } from '../../connections/services/ConnectionService'
import { CredentialRecord } from '../repository'
import { Lifecycle, scoped } from 'tsyringe'
import { CredentialRepository } from '../repository'
import { EventEmitter } from '../../../agent/EventEmitter'
import { ConsoleLogger, LogLevel } from '../../../logger'
import { CredentialProtocolVersion } from '../CredentialProtocolVersion'
import { createOutboundMessage } from '../../../agent/helpers'
import { HandlerInboundMessage } from 'packages/core/src/agent/Handler'
import { V2ProposeCredentialHandler } from '../v2/handlers/V2ProposeCredentialHandler'

const logger = new ConsoleLogger(LogLevel.debug)

@scoped(Lifecycle.ContainerScoped)
export class V1CredentialService extends CredentialService {

  // MJR-TODO: move these from credentialModules to here
  registerHandlers() {
      throw new Error('Method not implemented.')
  }
  
  processProposal(messageContext: HandlerInboundMessage<V2ProposeCredentialHandler>): Promise<CredentialRecord> {
    throw new Error('Method not implemented.')
  }

  private credentialService: V1LegacyCredentialService // MJR-TODO move all functionality from that class into here
  private connectionService: ConnectionService
  private credentialRepository: CredentialRepository
  private eventEmitter: EventEmitter
  private msgSender: MessageSender

  constructor(connectionService: ConnectionService,
    credentialService: V1LegacyCredentialService,
    credentialRepository: CredentialRepository,
    eventEmitter: EventEmitter,
    msgSender: MessageSender
  ) {
    super()
    this.credentialRepository = credentialRepository
    this.eventEmitter = eventEmitter
    this.credentialService = credentialService
    this.connectionService = connectionService
    this.msgSender = msgSender
  }

  public getVersion(): CredentialProtocolVersion {
    return CredentialProtocolVersion.V1_0
  }


  public async createProposal(proposal: ProposeCredentialOptions): Promise<{ credentialRecord: CredentialRecord, message: AgentMessage }> {
    logger.debug(">> IN SERVICE V1")

    const connection = await this.connectionService.getById(proposal.connectionId)

    let credentialProposal: CredentialPreview | undefined
    if (proposal?.credentialFormats.indy?.attributes) {
      credentialProposal = new CredentialPreview({ attributes: proposal?.credentialFormats.indy?.attributes })
    }

    const config: CredentialProposeOptions = {
      credentialProposal: credentialProposal,
      credentialDefinitionId: proposal.credentialFormats.indy?.credentialDefinitionId,
      linkedAttachments: proposal.credentialFormats.indy?.linkedAttachments
    }

    const { message, credentialRecord } = await this.credentialService.createProposal(connection, config)

    const outbound = createOutboundMessage(connection, message)

    await this.msgSender.sendMessage(outbound)

    return { credentialRecord, message }
  }

}
