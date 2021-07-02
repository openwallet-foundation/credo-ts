import type { AgentConfig } from '../../../agent/AgentConfig'
import type { HandlerInboundMessage } from '../../../agent/Handler'
import type { Logger } from '../../../logger'
import type { ConnectionRecord } from '../../connections/repository/ConnectionRecord'
import type {
  CredentialAckMessage,
  IssueCredentialMessage,
  OfferCredentialMessage,
  RequestCredentialMessage,
} from '../messages'
import type { CredentialRecord } from '../repository'
import type { CredentialService } from '../services'
import type { IssueCredentialHandler } from './IssueCredentialHandler'
import type { OfferCredentialHandler } from './OfferCredentialHandler'
import type { ProposeCredentialHandler } from './ProposeCredentialHandler'
import type { RequestCredentialHandler } from './RequestCredentialHandler'

import { createOutboundMessage } from '../../../agent/helpers'
import { AutoAcceptCredential } from '../../../types'
import { CredentialUtils } from '../CredentialUtils'

export class AutoRespondHandler {
  private credentialService: CredentialService

  public constructor(credentialService: CredentialService) {
    this.credentialService = credentialService
  }

  /**
   * Returns the credential auto accept config based on priority:
   *	- The record config takes first priority
   *	- Otherwise the agent config
   *	- Otherwise {@link AutoAcceptCredential.Never} is returned
   *
   * @param recordConfig The auto accept config for the record
   * @param agentConfig The auto accept config for the agent
   * @returns the auto accept config
   */
  private composeAutoAccept(
    recordConfig: AutoAcceptCredential | undefined,
    agentConfig: AutoAcceptCredential | undefined
  ) {
    return recordConfig ?? agentConfig ?? AutoAcceptCredential.Never
  }

  /**
   * Checks whether it should automatically respond to a proposal
   *
   * @param messageContext The context that is needed to respond on
   * @param credentialRecord The credentialRecord that contains the message(s) to respond to
   * @param agenConfig The configuration the used agent
   * @returns a message that will be send to the other agent
   */
  public async shoudlAutoRespondToProposal(
    messageContext: HandlerInboundMessage<ProposeCredentialHandler>,
    credentialRecord: CredentialRecord,
    agentConfig: AgentConfig
  ) {
    const autoAccept = this.composeAutoAccept(credentialRecord.autoAcceptCredential, agentConfig.autoAcceptCredentials)

    if (autoAccept === AutoAcceptCredential.Always) {
      return await this.sendOffer(credentialRecord, messageContext, autoAccept, agentConfig.logger)
    } else if (autoAccept === AutoAcceptCredential.ContentApproved) {
      if (
        credentialRecord.proposalMessage &&
        credentialRecord.offerMessage &&
        credentialRecord.proposalMessage.credentialProposal &&
        credentialRecord.credentialAttributes
      ) {
        const proposalValues = CredentialUtils.convertAttributesToValues(
          credentialRecord.proposalMessage.credentialProposal.attributes
        )

        const proposalCredentialDefinitionId = credentialRecord.proposalMessage.credentialDefinitionId

        const defaultValues = CredentialUtils.convertAttributesToValues(credentialRecord.credentialAttributes)

        const offerCredentialDefinitionId = credentialRecord.offerMessage.indyCredentialOffer?.cred_def_id

        if (
          CredentialUtils.checkValuesMatch(proposalValues, defaultValues) &&
          proposalCredentialDefinitionId === offerCredentialDefinitionId
        ) {
          return await this.sendOffer(credentialRecord, messageContext, autoAccept, agentConfig.logger)
        }
      }
    }
  }

  /**
   * Checks whether it should automatically respond to an offer
   *
   * @param messageContext The context that is needed to respond on
   * @param credentialRecord The credentialRecord that contains the message(s) to respond to
   * @param agenConfig The configuration the used agent
   * @returns a message that will be send to the other agent
   */
  public async shouldAutoRespondToOffer(
    messageContext: HandlerInboundMessage<OfferCredentialHandler>,
    credentialRecord: CredentialRecord,
    agentConfig: AgentConfig
  ) {
    const autoAccept = this.composeAutoAccept(credentialRecord.autoAcceptCredential, agentConfig.autoAcceptCredentials)

    if (autoAccept === AutoAcceptCredential.Always) {
      return await this.sendRequest(credentialRecord, messageContext, autoAccept, agentConfig.logger)
    } else if (autoAccept === AutoAcceptCredential.ContentApproved) {
      if (
        credentialRecord.proposalMessage &&
        credentialRecord.offerMessage &&
        credentialRecord.proposalMessage.credentialProposal &&
        credentialRecord.credentialAttributes
      ) {
        const defaultValues = CredentialUtils.convertAttributesToValues(credentialRecord.credentialAttributes)

        const proposalCredentialDefinitionId = credentialRecord.proposalMessage.credentialDefinitionId

        const offerValues = CredentialUtils.convertAttributesToValues(
          credentialRecord.offerMessage.credentialPreview.attributes
        )

        const offerCredentialDefinitionId = credentialRecord.offerMessage.indyCredentialOffer?.cred_def_id

        if (
          CredentialUtils.checkValuesMatch(defaultValues, offerValues) &&
          proposalCredentialDefinitionId === offerCredentialDefinitionId
        ) {
          return await this.sendRequest(credentialRecord, messageContext, autoAccept, agentConfig.logger)
        }
      }
    }
  }

  /**
   * Checks whether it should automatically respond to a request
   *
   * @param messageContext The context that is needed to respond on
   * @param credentialRecord The credentialRecord that contains the message(s) to respond to
   * @param agenConfig The configuration the used agent
   * @returns a message that will be send to the other agent
   */
  public async shouldAutoRespondToRequest(
    messageContext: HandlerInboundMessage<RequestCredentialHandler>,
    credentialRecord: CredentialRecord,
    agentConfig: AgentConfig
  ) {
    const autoAccept = this.composeAutoAccept(credentialRecord.autoAcceptCredential, agentConfig.autoAcceptCredentials)

    if (autoAccept === AutoAcceptCredential.Always) {
      return await this.sendCredential(credentialRecord, messageContext, autoAccept, agentConfig.logger)
    } else if (autoAccept === AutoAcceptCredential.ContentApproved) {
      if (credentialRecord.proposalMessage || credentialRecord.offerMessage) {
        const previousCredentialDefinitionId =
          credentialRecord.offerMessage?.indyCredentialOffer?.cred_def_id ??
          credentialRecord.proposalMessage?.credentialDefinitionId

        if (previousCredentialDefinitionId === credentialRecord.requestMessage?.indyCredentialRequest?.cred_def_id) {
          return await this.sendCredential(credentialRecord, messageContext, autoAccept, agentConfig.logger)
        }
      }
    }
  }

  /**
   * Checks whether it should automatically respond to the issuance of a credential
   *
   * @param messageContext The context that is needed to respond on
   * @param credentialRecord The credentialRecord that contains the message(s) to respond to
   * @param agenConfig The configuration the used agent
   * @returns a message that will be send to the other agent
   */
  public async shouldAutoRespondToIssue(
    messageContext: HandlerInboundMessage<IssueCredentialHandler>,
    credentialRecord: CredentialRecord,
    agentConfig: AgentConfig
  ) {
    const autoAccept = this.composeAutoAccept(credentialRecord.autoAcceptCredential, agentConfig.autoAcceptCredentials)

    if (autoAccept === AutoAcceptCredential.Always) {
      return await this.sendAck(credentialRecord, messageContext, autoAccept, agentConfig.logger)
    } else if (autoAccept === AutoAcceptCredential.ContentApproved) {
      if (credentialRecord.credentialAttributes && credentialRecord.credentialMessage) {
        const indyCredential = credentialRecord.credentialMessage.indyCredential

        if (!indyCredential) {
          agentConfig.logger.error(`Missing required base64 encoded attachment data for credential`)
          return
        }

        const credentialMessageValues = indyCredential.values
        const defaultValues = CredentialUtils.convertAttributesToValues(credentialRecord.credentialAttributes)

        if (CredentialUtils.checkValuesMatch(credentialMessageValues, defaultValues)) {
          return await this.sendAck(credentialRecord, messageContext, autoAccept, agentConfig.logger)
        }
      }
    }
  }

  /**
   * Sends an offer message to the other agent
   *
   * @param credentialRecord The credentialRecord that contains the message(s) to respond to
   * @param messageContext The context that is needed to respond on
   * @param autoAccept which level of auto acceptance is used
   * @param logger The logger that will be used
   * @returns a message that will be send to the other agent
   */
  private async sendOffer(
    credentialRecord: CredentialRecord,
    messageContext: HandlerInboundMessage<ProposeCredentialHandler>,
    autoAccept: AutoAcceptCredential,
    logger: Logger
  ) {
    logger.info(`Automatically sending offer with autoAccept on ${autoAccept}`)

    if (!messageContext.connection) {
      logger.error('No connection on the messageContext, aborting auto accept')
      return
    }

    if (!credentialRecord.proposalMessage?.credentialProposal) {
      logger.error(`Credential record with id ${credentialRecord.id} is missing required credential proposal`)
      return
    }

    if (!credentialRecord.proposalMessage.credentialDefinitionId) {
      logger.error('Missing required credential definition id')
      return
    }

    const { message } = await this.credentialService.createOfferAsResponse(credentialRecord, {
      credentialDefinitionId: credentialRecord.proposalMessage.credentialDefinitionId,
      preview: credentialRecord.proposalMessage.credentialProposal,
    })

    return this.sendMessage(messageContext.connection, message)
  }

  /**
   * Sends a request to the other agent
   *
   * @param credentialRecord The credentialRecord that contains the message(s) to respond to
   * @param messageContext The context that is needed to respond on
   * @param autoAccept which level of auto acceptance is used
   * @param logger The logger that will be used
   * @returns a message that will be send to the other agent
   */
  private async sendRequest(
    credentialRecord: CredentialRecord,
    messageContext: HandlerInboundMessage<OfferCredentialHandler>,
    autoAccept: AutoAcceptCredential,
    logger: Logger
  ) {
    logger.info(`Automatically sending request with autoAccept on ${autoAccept}`)

    if (!messageContext.connection) {
      logger.error(`No connection on the messageContext`)
      return
    }

    const { message } = await this.credentialService.createRequest(credentialRecord)

    return this.sendMessage(messageContext.connection, message)
  }

  /**
   * Sends a credential message to the other agent
   *
   * @param credentialRecord The credentialRecord that contains the message(s) to respond to
   * @param messageContext The context that is needed to respond on
   * @param autoAccept which level of auto acceptance is used
   * @param logger The logger that will be used
   * @returns a message that will be send to the other agent
   */
  private async sendCredential(
    credentialRecord: CredentialRecord,
    messageContext: HandlerInboundMessage<RequestCredentialHandler>,
    autoAccept: AutoAcceptCredential,
    logger: Logger
  ) {
    logger.info(`Automatically sending credential with autoAccept on ${autoAccept}`)

    if (!messageContext.connection) {
      logger.error(`No connection on the messageContext`)
      return
    }

    const { message } = await this.credentialService.createCredential(credentialRecord)

    return this.sendMessage(messageContext.connection, message)
  }

  /**
   * Sends an acknowledgement message to the other agent
   *
   * @param credentialRecord The credentialRecord that contains the message(s) to respond to
   * @param messageContext The context that is needed to respond on
   * @param autoAccept which level of auto acceptance is used
   * @param logger The logger that will be used
   * @returns a message that will be send to the other agent
   */
  private async sendAck(
    credentialRecord: CredentialRecord,
    messageContext: HandlerInboundMessage<IssueCredentialHandler>,
    autoAccept: AutoAcceptCredential,
    logger: Logger
  ) {
    logger.info(`Automatically sending acknowledgement with autoAccept on ${autoAccept}`)

    if (!messageContext.connection) {
      logger.error(`No connection on the messageContext`)
      return
    }
    const { message } = await this.credentialService.createAck(credentialRecord)

    return this.sendMessage(messageContext.connection, message)
  }

  /**
   * Sends the message to the connection
   *
   * @param connection A {@link ConnectionRecord} that is used to send the message to
   * @param message A message that has to be send
   *
   */
  private sendMessage(
    connection: ConnectionRecord,
    message: OfferCredentialMessage | RequestCredentialMessage | IssueCredentialMessage | CredentialAckMessage
  ) {
    return createOutboundMessage(connection, message)
  }
}
