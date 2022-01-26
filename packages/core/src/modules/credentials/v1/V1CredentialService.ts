import type {
  CredentialOfferTemplate,
  CredentialProposeOptions,
  CredentialProtocolMsgReturnType,
  V1LegacyCredentialService,
} from '.'
import type { AgentMessage } from '../../../agent/AgentMessage'
import type { ConnectionService } from '../../connections/services/ConnectionService'
import type {
  AcceptProposalOptions,
  AcceptRequestOptions,
  CredPropose,
  NegotiateProposalOptions,
  OfferCredentialOptions,
  ProposeCredentialOptions,
  RequestCredentialOptions,
} from '../interfaces'
import type { CredentialRecord } from '../repository'
import type { V2CredProposeOfferRequestFormat, CredentialFormatService } from '../v2/formats/CredentialFormatService'
import type { V2CredentialAckMessage } from '../v2/messages/V2CredentialAckMessage'
import type { V2IssueCredentialMessage } from '../v2/messages/V2IssueCredentialMessage'
import type { V2RequestCredentialMessage } from '../v2/messages/V2RequestCredentialMessage'
import type { OfferCredentialHandler, ProposeCredentialHandler } from './handlers'
import type {
  CredentialAckMessage,
  IssueCredentialMessage,
  OfferCredentialMessage,
  ProposeCredentialMessage,
  RequestCredentialMessage,
} from './messages'
import type { HandlerInboundMessage } from 'packages/core/src/agent/Handler'
import type { InboundMessageContext } from 'packages/core/src/agent/models/InboundMessageContext'

import { AriesFrameworkError } from '../../../error'
import { ConsoleLogger, LogLevel } from '../../../logger'
import { isLinkedAttachment } from '../../../utils/attachment'
import { CredentialProtocolVersion } from '../CredentialProtocolVersion'
import { CredentialService } from '../CredentialService'

import { V1CredentialPreview } from './V1CredentialPreview'

const logger = new ConsoleLogger(LogLevel.debug)

export class V1CredentialService extends CredentialService {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public processCredential(
    messageContext: InboundMessageContext<V2IssueCredentialMessage | IssueCredentialMessage>
  ): Promise<CredentialRecord> {
    throw new Error('Method not implemented.')
  }
  public createAck(
    credentialRecord: CredentialRecord
  ): Promise<CredentialProtocolMsgReturnType<CredentialAckMessage | V2CredentialAckMessage>> {
    throw new Error('Method not implemented.')
  }
  public createCredential(
    credentialRecord: CredentialRecord,
    options?: AcceptRequestOptions
  ): Promise<CredentialProtocolMsgReturnType<IssueCredentialMessage | V2IssueCredentialMessage>> {
    return this.legacyCredentialService.createCredential(credentialRecord, options)
  }

  public processRequest(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    messageContext: InboundMessageContext<RequestCredentialMessage | V2RequestCredentialMessage>
  ): Promise<CredentialRecord> {
    throw new Error('Method not implemented.')
  }
  private legacyCredentialService: V1LegacyCredentialService // MJR-TODO move all functionality from that class into here
  private connectionService: ConnectionService

  public constructor(connectionService: ConnectionService, credentialService: V1LegacyCredentialService) {
    super()
    this.legacyCredentialService = credentialService
    this.connectionService = connectionService
  }

  /**
   * Process a received {@link ProposeCredentialMessage}. This will not accept the credential proposal
   * or send a credential offer. It will only create a new, or update the existing credential record with
   * the information from the credential proposal message. Use {@link V1LegacyCredentialService#createOfferAsResponse}
   * after calling this method to create a credential offer.
   *
   * @param messageContext The message context containing a credential proposal message
   * @returns credential record associated with the credential proposal message
   *
   */
  public processProposal(messageContext: HandlerInboundMessage<ProposeCredentialHandler>): Promise<CredentialRecord> {
    return this.legacyCredentialService.processProposal(messageContext)
  }

  /**
   * Process a received {@link OfferCredentialMessage}. This will not accept the credential offer
   * or send a credential request. It will only create a new credential record with
   * the information from the credential offer message. Use {@link V1LegacyCredentialService#createRequest}
   * after calling this method to create a credential request.
   *
   * @param messageContext The message context containing a credential request message
   * @returns credential record associated with the credential offer message
   *
   */
  public processOffer(messageContext: HandlerInboundMessage<OfferCredentialHandler>): Promise<CredentialRecord> {
    return this.legacyCredentialService.processOffer(messageContext)
  }

  /**
   * Create a {@link OfferCredentialMessage} as response to a received credential proposal.
   * To create an offer not bound to an existing credential exchange, use {@link V1LegacyCredentialService#createOffer}.
   *
   * @param credentialRecord The credential record for which to create the credential offer
   * @param credentialTemplate The credential template to use for the offer
   * @returns Object containing offer message and associated credential record
   *
   */
  public async createOfferAsResponse(
    credentialRecord: CredentialRecord,
    credentialTemplate: CredentialOfferTemplate
  ): Promise<CredentialProtocolMsgReturnType<OfferCredentialMessage>> {
    return this.legacyCredentialService.createOfferAsResponse(credentialRecord, credentialTemplate)
  }

  public registerHandlers() {
    throw new Error('Method not implemented.')
  }

  /**
   *
   * Get the version of Issue Credentials according to AIP1.0 or AIP2.0
   * @returns the version of this credential service
   */
  public getVersion(): CredentialProtocolVersion {
    return CredentialProtocolVersion.V1_0
  }

  /**
   * Create a {@link ProposeCredentialMessage} not bound to an existing credential exchange.
   * To create a proposal as response to an existing credential exchange, use {@link V1LegacyCredentialService#createProposalAsResponse}.
   *
   * @param proposal The object containing config options
   * @returns Object containing proposal message and associated credential record
   *
   */
  public async createProposal(
    proposal: ProposeCredentialOptions
  ): Promise<{ credentialRecord: CredentialRecord; message: AgentMessage }> {
    logger.debug('>> IN SERVICE V1 => createProposal')

    const connection = await this.connectionService.getById(proposal.connectionId)

    let credentialProposal: V1CredentialPreview | undefined

    const credPropose: CredPropose = proposal.credentialFormats.indy?.payload.credentialPayload as CredPropose

    if (credPropose.attributes) {
      credentialProposal = new V1CredentialPreview({ attributes: credPropose.attributes })
    }

    const config: CredentialProposeOptions = {
      credentialProposal: credentialProposal,
      credentialDefinitionId: credPropose.credentialDefinitionId,
      linkedAttachments: credPropose.linkedAttachments,
    }

    // MJR-TODO flip these params around to save a line of code
    const { message, credentialRecord } = await this.legacyCredentialService.createProposal(connection, config)

    return { credentialRecord, message }
  }

  /**
   * Processing an incoming credential message and create a credential offer as a response
   * @param proposal The object containing config options
   * @returns Object containing proposal message and associated credential record
   */
  public async acceptProposal(
    proposal: AcceptProposalOptions
  ): Promise<{ credentialRecord: CredentialRecord; message: AgentMessage }> {
    logger.debug('>> IN SERVICE V1 => acceptProposal')

    const credentialRecord = await this.legacyCredentialService.getById(proposal.credentialRecordId)

    if (!credentialRecord.connectionId) {
      throw new AriesFrameworkError(
        `No connectionId found for credential record '${credentialRecord.id}'. Connection-less issuance does not support credential proposal or negotiation.`
      )
    }
    const credentialProposalMessage: ProposeCredentialMessage =
      credentialRecord.proposalMessage as ProposeCredentialMessage
    if (!credentialProposalMessage?.credentialProposal) {
      throw new AriesFrameworkError(
        `Credential record with id ${proposal.credentialRecordId} is missing required credential proposal`
      )
    }

    const credentialDefinitionId =
      proposal.credentialFormats.indy?.credentialDefinitionId ?? credentialProposalMessage.credentialDefinitionId

      console.log("QUACK attachment = ", credentialRecord.linkedAttachments)
    credentialRecord.linkedAttachments = credentialProposalMessage.attachments?.filter((attachment) =>
      isLinkedAttachment(attachment)
    )

    if (!credentialDefinitionId) {
      throw new AriesFrameworkError(
        'Missing required credential definition id. If credential proposal message contains no credential definition id it must be passed to config.'
      )
    }

    const { message } = await this.createOfferAsResponse(credentialRecord, {
      preview: credentialProposalMessage.credentialProposal,
      credentialDefinitionId,
      comment: proposal.comment,
      autoAcceptCredential: proposal.autoAcceptCredential,
      attachments: credentialRecord.linkedAttachments,
    })

    return { credentialRecord, message }
  }

  /**
   * Create a {@link RequestCredentialMessage} as response to a received credential offer.
   *
   * @param credentialRecord The credential record for which to create the credential request
   * @param options Additional configuration to use for the credential request See {@link RequestCredentialOptions}
   * @returns Object containing request message and associated credential record
   *
   */
  public async createRequest(
    credentialRecord: CredentialRecord,
    options: RequestCredentialOptions
  ): Promise<CredentialProtocolMsgReturnType<RequestCredentialMessage>> {
    // mapping from RequestCredentialOptions -> CredentialRequesOptions happens
    // here
    return this.legacyCredentialService.createRequest(credentialRecord, options)
  }

  /**
   * Negotiate a credential proposal as issuer (by sending a credential offer message) to the connection
   * associated with the credential record.
   *
   * @param credentialOptions configuration for the offer see {@link NegotiateProposalOptions}
   * @returns Credential exchange record associated with the credential offer
   *
   */
  public async negotiateProposal(
    credentialOptions: NegotiateProposalOptions
  ): Promise<{ credentialRecord: CredentialRecord; message: AgentMessage }> {
    const credentialRecord = await this.legacyCredentialService.getById(credentialOptions.credentialRecordId)

    if (!credentialRecord.connectionId) {
      throw new AriesFrameworkError(
        `No connectionId found for credential record '${credentialRecord.id}'. Connection-less issuance does not support negotiation.`
      )
    }

    const credentialProposalMessage: ProposeCredentialMessage =
      credentialRecord.proposalMessage as ProposeCredentialMessage

    if (!credentialProposalMessage?.credentialProposal) {
      throw new AriesFrameworkError(
        `Credential record with id ${credentialOptions.credentialRecordId} is missing required credential proposal`
      )
    }

    const credentialDefinitionId =
      credentialOptions.credentialFormats.indy?.credentialDefinitionId ??
      credentialProposalMessage.credentialDefinitionId

    if (!credentialDefinitionId) {
      throw new AriesFrameworkError(
        'Missing required credential definition id. If credential proposal message contains no credential definition id it must be passed to config.'
      )
    }

    let newCredentialProposal: V1CredentialPreview
    if (credentialOptions?.credentialFormats.indy?.attributes) {
      newCredentialProposal = new V1CredentialPreview({
        attributes: credentialOptions?.credentialFormats.indy?.attributes,
      })
    } else {
      throw Error('No proposal attributes in the negotiation options!')
    }

    const { message } = await this.createOfferAsResponse(credentialRecord, {
      preview: newCredentialProposal,
      credentialDefinitionId,
      comment: credentialOptions.comment,
      autoAcceptCredential: credentialOptions.autoAcceptCredential,
      attachments: credentialRecord.linkedAttachments,
    })
    return { credentialRecord, message }
  }

  /**
   * Create a {@link OfferCredentialMessage} not bound to an existing credential exchange.
   * To create an offer as response to an existing credential exchange, use {@link V1CredentialService#createOfferAsResponse}.
   *
   * @param credentialOptions The options containing config params for creating the credential offer
   * @returns Object containing offer message and associated credential record
   *
   */
  public async createOffer(
    credentialOptions: OfferCredentialOptions
  ): Promise<{ credentialRecord: CredentialRecord; message: AgentMessage }> {
    const connection = await this.connectionService.getById(credentialOptions.connectionId)

    if (
      credentialOptions?.credentialFormats.indy?.attributes &&
      credentialOptions?.credentialFormats.indy?.credentialDefinitionId
    ) {
      const credentialPreview: V1CredentialPreview = new V1CredentialPreview({
        attributes: credentialOptions.credentialFormats.indy?.attributes,
      })

      const template: CredentialOfferTemplate = {
        ...credentialOptions,
        preview: credentialPreview,
        credentialDefinitionId: credentialOptions?.credentialFormats.indy?.credentialDefinitionId,
      }
      return await this.legacyCredentialService.createOffer(template, connection)
    }

    throw Error('Missing properties from OfferCredentialOptions object: cannot create Offer!')
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public getFormats(credentialFormats: V2CredProposeOfferRequestFormat): CredentialFormatService[] {
    throw new Error('Method not implemented.')
  }
}
