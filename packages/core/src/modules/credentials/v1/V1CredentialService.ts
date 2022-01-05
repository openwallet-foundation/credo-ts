
import { AgentMessage, AriesFrameworkError, MessageSender } from '@aries-framework/core'
import { CredentialService } from '../CredentialService'
import { AcceptProposalOptions, ProposeCredentialOptions } from '../v2/interfaces'
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
import { isLinkedAttachment } from '../../../utils/attachment'
import { OfferCredentialHandler, ProposeCredentialHandler } from './handlers'

const logger = new ConsoleLogger(LogLevel.debug)

export class V1CredentialService extends CredentialService {

  // MJR-TODO: move these from credentialModules to here

  processProposal(messageContext: HandlerInboundMessage<ProposeCredentialHandler>): Promise<CredentialRecord> {
    return this.legacyCredentialService.processProposal(messageContext)
  }

  processOffer(messageContext: HandlerInboundMessage<OfferCredentialHandler>): Promise<CredentialRecord> {
    return this.legacyCredentialService.processOffer(messageContext)
  }

  registerHandlers() {
    throw new Error('Method not implemented.')
  }
  private legacyCredentialService: V1LegacyCredentialService // MJR-TODO move all functionality from that class into here
  private connectionService: ConnectionService

  constructor(connectionService: ConnectionService,
    credentialService: V1LegacyCredentialService
  ) {
    super()
    this.legacyCredentialService = credentialService
    this.connectionService = connectionService
  }

  public getVersion(): CredentialProtocolVersion {
    return CredentialProtocolVersion.V1_0
  }


  public async createProposal(proposal: ProposeCredentialOptions): Promise<{ credentialRecord: CredentialRecord, message: AgentMessage }> {
    logger.debug(">> IN SERVICE V1 => createProposal")

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

    // MJR-TODO flip these params around to save a line of code
    const { message, credentialRecord } = await this.legacyCredentialService.createProposal(connection, config)

    return { credentialRecord, message }
  }

  public async acceptProposal(proposal: AcceptProposalOptions): Promise<{ credentialRecord: CredentialRecord, message: AgentMessage }> {
    logger.debug(">> IN SERVICE V1 => acceptProposal")

    const credentialRecord = await this.legacyCredentialService.getById(proposal.credentialRecordId)
    if (!credentialRecord.connectionId) {
      throw new AriesFrameworkError(
        `No connectionId found for credential record '${credentialRecord.id}'. Connection-less issuance does not support credential proposal or negotiation.`
      )
    }
    const credentialProposalMessage = credentialRecord.proposalMessage
    if (!credentialProposalMessage?.credentialProposal) {
      throw new AriesFrameworkError(
        `Credential record with id ${proposal.credentialRecordId} is missing required credential proposal`
      )
    }

    const credentialDefinitionId = proposal.credentialFormats.indy?.credentialDefinitionId ?? credentialProposalMessage.credentialDefinitionId

    credentialRecord.linkedAttachments = credentialProposalMessage.attachments?.filter((attachment) =>
      isLinkedAttachment(attachment)
    )

    if (!credentialDefinitionId) {
      throw new AriesFrameworkError(
        'Missing required credential definition id. If credential proposal message contains no credential definition id it must be passed to config.'
      )
    }

    // TODO: check if it is possible to issue credential based on proposal filters
    const { message } = await this.legacyCredentialService.createOfferAsResponse(credentialRecord, {
      preview: credentialProposalMessage.credentialProposal,
      credentialDefinitionId,
      comment: proposal.comment,
      autoAcceptCredential: proposal.autoAcceptCredential,
      attachments: credentialRecord.linkedAttachments,
    })

    return { credentialRecord, message }
  }

}
