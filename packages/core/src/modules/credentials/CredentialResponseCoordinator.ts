import type {
  IssueCredentialMessage,
  OfferCredentialMessage,
  ProposeCredentialMessage,
  RequestCredentialMessage,
} from '.'
import type { CredentialExchangeRecord } from './repository'

import { scoped, Lifecycle } from 'tsyringe'

import { AgentConfig } from '../../agent/AgentConfig'
import { DidCommMessageRepository } from '../../storage'

import { AutoAcceptCredential } from './CredentialAutoAcceptType'
import { CredentialUtils } from './CredentialUtils'

/**
 * This class handles all the automation with all the messages in the issue credential protocol
 * Every function returns `true` if it should automate the flow and `false` if not
 */
@scoped(Lifecycle.ContainerScoped)
export class CredentialResponseCoordinator {
  private agentConfig: AgentConfig
  private didCommMessageRepository: DidCommMessageRepository

  public constructor(agentConfig: AgentConfig, didCommMessageRepository: DidCommMessageRepository) {
    this.agentConfig = agentConfig
    this.didCommMessageRepository = didCommMessageRepository
  }

  /**
   * Returns the credential auto accept config based on priority:
   *	- The record config takes first priority
   *	- Otherwise the agent config
   *	- Otherwise {@link AutoAcceptCredential.Never} is returned
   */
  public static composeAutoAccept(
    recordConfig: AutoAcceptCredential | undefined,
    agentConfig: AutoAcceptCredential | undefined
  ) {
    return recordConfig ?? agentConfig ?? AutoAcceptCredential.Never
  }

  /**
   * Checks whether it should automatically respond to a proposal
   */
  public shouldAutoRespondToProposal(
    credentialRecord: CredentialExchangeRecord,
    proposeMessage?: ProposeCredentialMessage,
    offerMessage?: OfferCredentialMessage
  ) {
    const autoAccept = CredentialResponseCoordinator.composeAutoAccept(
      credentialRecord.autoAcceptCredential,
      this.agentConfig.autoAcceptCredentials
    )

    if (autoAccept === AutoAcceptCredential.Always) {
      return true
    } else if (autoAccept === AutoAcceptCredential.ContentApproved) {
      return (
        this.areProposalValuesValid(credentialRecord, proposeMessage) &&
        this.areProposalAndOfferDefinitionIdEqual(credentialRecord, proposeMessage, offerMessage)
      )
    }
    return false
  }

  /**
   * Checks whether it should automatically respond to an offer
   */
  public shouldAutoRespondToOffer(
    credentialRecord: CredentialExchangeRecord,
    proposeMessage?: ProposeCredentialMessage,
    offerMessage?: OfferCredentialMessage
  ) {
    const autoAccept = CredentialResponseCoordinator.composeAutoAccept(
      credentialRecord.autoAcceptCredential,
      this.agentConfig.autoAcceptCredentials
    )
    this.areProposalAndOfferDefinitionIdEqual(credentialRecord, proposeMessage, offerMessage)
    if (autoAccept === AutoAcceptCredential.Always) {
      return true
    } else if (autoAccept === AutoAcceptCredential.ContentApproved) {
      return (
        this.areOfferValuesValid(credentialRecord, offerMessage) &&
        this.areProposalAndOfferDefinitionIdEqual(credentialRecord, proposeMessage, offerMessage)
      )
    }
    return false
  }

  /**
   * Checks whether it should automatically respond to a request
   */
  public shouldAutoRespondToRequest(
    credentialRecord: CredentialExchangeRecord,
    proposeMessage?: ProposeCredentialMessage,
    offerMessage?: OfferCredentialMessage,
    requestMessage?: RequestCredentialMessage
  ) {
    const autoAccept = CredentialResponseCoordinator.composeAutoAccept(
      credentialRecord.autoAcceptCredential,
      this.agentConfig.autoAcceptCredentials
    )

    if (autoAccept === AutoAcceptCredential.Always) {
      return true
    } else if (autoAccept === AutoAcceptCredential.ContentApproved) {
      return this.isRequestDefinitionIdValid(credentialRecord, proposeMessage, offerMessage, requestMessage)
    }
    return false
  }

  /**
   * Checks whether it should automatically respond to the issuance of a credential
   */
  public shouldAutoRespondToIssue(
    credentialRecord: CredentialExchangeRecord,
    credentialMessage: IssueCredentialMessage
  ) {
    const autoAccept = CredentialResponseCoordinator.composeAutoAccept(
      credentialRecord.autoAcceptCredential,
      this.agentConfig.autoAcceptCredentials
    )

    if (autoAccept === AutoAcceptCredential.Always) {
      return true
    } else if (autoAccept === AutoAcceptCredential.ContentApproved) {
      return this.areCredentialValuesValid(credentialRecord, credentialMessage)
    }
    return false
  }

  private areProposalValuesValid(
    credentialRecord: CredentialExchangeRecord,
    proposalMessage?: ProposeCredentialMessage
  ) {
    const { credentialAttributes } = credentialRecord

    if (proposalMessage && proposalMessage.credentialProposal && credentialAttributes) {
      const proposalValues = CredentialUtils.convertAttributesToValues(proposalMessage.credentialProposal.attributes)
      const defaultValues = CredentialUtils.convertAttributesToValues(credentialAttributes)
      if (CredentialUtils.checkValuesMatch(proposalValues, defaultValues)) {
        return true
      }
    }
    return false
  }

  private areOfferValuesValid(credentialRecord: CredentialExchangeRecord, offerMessage?: OfferCredentialMessage) {
    const { credentialAttributes } = credentialRecord
    if (offerMessage && credentialAttributes && offerMessage.credentialPreview) {
      const offerValues = CredentialUtils.convertAttributesToValues(offerMessage.credentialPreview.attributes)
      const defaultValues = CredentialUtils.convertAttributesToValues(credentialAttributes)
      if (CredentialUtils.checkValuesMatch(offerValues, defaultValues)) {
        return true
      }
    }
    return false
  }

  private areCredentialValuesValid(
    credentialRecord: CredentialExchangeRecord,
    credentialMessage: IssueCredentialMessage
  ) {
    const msg: IssueCredentialMessage | undefined = credentialMessage as IssueCredentialMessage

    if (credentialRecord.credentialAttributes && credentialMessage) {
      const indyCredential = msg.indyCredential

      if (!indyCredential) {
        this.agentConfig.logger.error(`Missing required base64 encoded attachment data for credential`)
        return false
      }

      const credentialMessageValues = indyCredential.values
      const defaultValues = CredentialUtils.convertAttributesToValues(credentialRecord.credentialAttributes)

      if (CredentialUtils.checkValuesMatch(credentialMessageValues, defaultValues)) {
        return true
      }
    }
    return false
  }

  private areProposalAndOfferDefinitionIdEqual(
    credentialRecord: CredentialExchangeRecord,
    proposalMessage?: ProposeCredentialMessage,
    offerMessage?: OfferCredentialMessage
  ) {
    const proposeMessage: ProposeCredentialMessage | undefined = proposalMessage as ProposeCredentialMessage
    const proposalCredentialDefinitionId = proposeMessage?.credentialDefinitionId
    const offerCredentialDefinitionId = offerMessage?.indyCredentialOffer?.cred_def_id
    return proposalCredentialDefinitionId === offerCredentialDefinitionId
  }

  private async isRequestDefinitionIdValid(
    credentialRecord: CredentialExchangeRecord,
    proposeMessage?: ProposeCredentialMessage,
    offerMessage?: OfferCredentialMessage,
    requestMessage?: RequestCredentialMessage
  ) {
    if (proposeMessage || offerMessage) {
      const previousCredentialDefinitionId =
        offerMessage?.indyCredentialOffer?.cred_def_id ?? proposeMessage?.credentialDefinitionId

      if (previousCredentialDefinitionId === requestMessage?.indyCredentialRequest?.cred_def_id) {
        return true
      }
    }
    return false
  }
}
