import type { Logger } from '../../../logger/Logger'
import type { CredentialRecord } from '../repository'

import { AutoAcceptCredential } from '../../../types'
import { CredentialUtils } from '../CredentialUtils'

/**
 * This class handles all the automation with all the messages in the issue credential protocol
 * Every function returns `true` if it should automate the flow and `false` if not
 */
export class AutoResponseHandler {
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
  private static composeAutoAccept(
    recordConfig: AutoAcceptCredential | undefined,
    agentConfig: AutoAcceptCredential | undefined
  ) {
    return recordConfig ?? agentConfig ?? AutoAcceptCredential.Never
  }

  /**
   * Checks whether it should automatically respond to a proposal
   *
   * @param credentialRecord The credentialRecord that contains the message(s) to respond to
   * @param agentAutoAccept The configuration on the agent whether to auto accept
   * @returns a message that will be send to the other agent
   */
  public static async shoudlAutoRespondToProposal(
    credentialRecord: CredentialRecord,
    agentAutoAccept: AutoAcceptCredential
  ) {
    const autoAccept = this.composeAutoAccept(credentialRecord.autoAcceptCredential, agentAutoAccept)

    if (autoAccept === AutoAcceptCredential.Always) {
      return true
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
          return true
        }
      }
    }
    return false
  }

  /**
   * Checks whether it should automatically respond to an offer
   *
   * @param credentialRecord The credentialRecord that contains the message(s) to respond to
   * @param agentAutoAccept The configuration on the agent whether to auto accept
   * @returns a message that will be send to the other agent
   */
  public static async shouldAutoRespondToOffer(
    credentialRecord: CredentialRecord,
    agentAutoAccept: AutoAcceptCredential
  ) {
    const autoAccept = this.composeAutoAccept(credentialRecord.autoAcceptCredential, agentAutoAccept)

    if (autoAccept === AutoAcceptCredential.Always) {
      return true
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
          return true
        }
      }
    }
    return false
  }

  /**
   * Checks whether it should automatically respond to a request
   *
   * @param credentialRecord The credentialRecord that contains the message(s) to respond to
   * @param agentAutoAccept The configuration on the agent whether to auto accept
   * @returns a message that will be send to the other agent
   */
  public static async shouldAutoRespondToRequest(
    credentialRecord: CredentialRecord,
    agentAutoAccept: AutoAcceptCredential
  ) {
    const autoAccept = this.composeAutoAccept(credentialRecord.autoAcceptCredential, agentAutoAccept)

    if (autoAccept === AutoAcceptCredential.Always) {
      return true
    } else if (autoAccept === AutoAcceptCredential.ContentApproved) {
      if (credentialRecord.proposalMessage || credentialRecord.offerMessage) {
        const previousCredentialDefinitionId =
          credentialRecord.offerMessage?.indyCredentialOffer?.cred_def_id ??
          credentialRecord.proposalMessage?.credentialDefinitionId

        if (previousCredentialDefinitionId === credentialRecord.requestMessage?.indyCredentialRequest?.cred_def_id) {
          return true
        }
      }
    }
    return false
  }

  /**
   * Checks whether it should automatically respond to the issuance of a credential
   *
   * @param credentialRecord The credentialRecord that contains the message(s) to respond to
   * @param agentAutoAccept The configuration on the agent whether to auto accept
   * @returns a message that will be send to the other agent
   */
  public static async shouldAutoRespondToIssue(
    credentialRecord: CredentialRecord,
    agentAutoAccept: AutoAcceptCredential,
    logger: Logger
  ) {
    const autoAccept = this.composeAutoAccept(credentialRecord.autoAcceptCredential, agentAutoAccept)

    if (autoAccept === AutoAcceptCredential.Always) {
      return true
    } else if (autoAccept === AutoAcceptCredential.ContentApproved) {
      if (credentialRecord.credentialAttributes && credentialRecord.credentialMessage) {
        const indyCredential = credentialRecord.credentialMessage.indyCredential

        if (!indyCredential) {
          logger.error(`Missing required base64 encoded attachment data for credential`)
          return false
        }

        const credentialMessageValues = indyCredential.values
        const defaultValues = CredentialUtils.convertAttributesToValues(credentialRecord.credentialAttributes)

        if (CredentialUtils.checkValuesMatch(credentialMessageValues, defaultValues)) {
          return true
        }
      }
    }
    return false
  }
}
