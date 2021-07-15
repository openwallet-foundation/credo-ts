import type { CredentialRecord } from './repository'

import { scoped, Lifecycle } from 'tsyringe'

import { AgentConfig } from '../../agent/AgentConfig'

import { AutoAcceptCredential } from './CredentialAutoAcceptType'
import { CredentialUtils } from './CredentialUtils'

/**
 * This class handles all the automation with all the messages in the issue credential protocol
 * Every function returns `true` if it should automate the flow and `false` if not
 */
@scoped(Lifecycle.ContainerScoped)
export class CredentialResponseCoordinator {
  private agentConfig: AgentConfig

  public constructor(agentConfig: AgentConfig) {
    this.agentConfig = agentConfig
  }

  /**
   * Returns the credential auto accept config based on priority:
   *	- The record config takes first priority
   *	- Otherwise the agent config
   *	- Otherwise {@link AutoAcceptCredential.Never} is returned
   */
  private static composeAutoAccept(
    recordConfig: AutoAcceptCredential | undefined,
    agentConfig: AutoAcceptCredential | undefined
  ) {
    return recordConfig ?? agentConfig ?? AutoAcceptCredential.Never
  }

  /**
   * Checks whether it should automatically respond to a proposal
   */
  public shouldAutoRespondToProposal(credentialRecord: CredentialRecord) {
    const autoAccept = CredentialResponseCoordinator.composeAutoAccept(
      credentialRecord.autoAcceptCredential,
      this.agentConfig.autoAcceptCredentials
    )

    if (autoAccept === AutoAcceptCredential.Always) {
      return true
    } else if (autoAccept === AutoAcceptCredential.ContentApproved) {
      return (
        this.areProposalValuesValid(credentialRecord) && this.areProposalAndOfferDefinitionIdEqual(credentialRecord)
      )
    }
    return false
  }

  /**
   * Checks whether it should automatically respond to an offer
   */
  public shouldAutoRespondToOffer(credentialRecord: CredentialRecord) {
    const autoAccept = CredentialResponseCoordinator.composeAutoAccept(
      credentialRecord.autoAcceptCredential,
      this.agentConfig.autoAcceptCredentials
    )

    if (autoAccept === AutoAcceptCredential.Always) {
      return true
    } else if (autoAccept === AutoAcceptCredential.ContentApproved) {
      return this.areOfferValuesValid(credentialRecord) && this.areProposalAndOfferDefinitionIdEqual(credentialRecord)
    }
    return false
  }

  /**
   * Checks whether it should automatically respond to a request
   */
  public shouldAutoRespondToRequest(credentialRecord: CredentialRecord) {
    const autoAccept = CredentialResponseCoordinator.composeAutoAccept(
      credentialRecord.autoAcceptCredential,
      this.agentConfig.autoAcceptCredentials
    )

    if (autoAccept === AutoAcceptCredential.Always) {
      return true
    } else if (autoAccept === AutoAcceptCredential.ContentApproved) {
      return this.isRequestDefinitionIdValid(credentialRecord)
    }
    return false
  }

  /**
   * Checks whether it should automatically respond to the issuance of a credential
   */
  public shouldAutoRespondToIssue(credentialRecord: CredentialRecord) {
    const autoAccept = CredentialResponseCoordinator.composeAutoAccept(
      credentialRecord.autoAcceptCredential,
      this.agentConfig.autoAcceptCredentials
    )

    if (autoAccept === AutoAcceptCredential.Always) {
      return true
    } else if (autoAccept === AutoAcceptCredential.ContentApproved) {
      return this.areCredentialValuesValid(credentialRecord)
    }
    return false
  }

  private areProposalValuesValid(credentialRecord: CredentialRecord) {
    const { proposalMessage, credentialAttributes } = credentialRecord

    if (proposalMessage && proposalMessage.credentialProposal && credentialAttributes) {
      const proposalValues = CredentialUtils.convertAttributesToValues(proposalMessage.credentialProposal.attributes)
      const defaultValues = CredentialUtils.convertAttributesToValues(credentialAttributes)
      if (CredentialUtils.checkValuesMatch(proposalValues, defaultValues)) {
        return true
      }
    }
    return false
  }

  private areOfferValuesValid(credentialRecord: CredentialRecord) {
    const { offerMessage, credentialAttributes } = credentialRecord

    if (offerMessage && credentialAttributes) {
      const offerValues = CredentialUtils.convertAttributesToValues(offerMessage.credentialPreview.attributes)
      const defaultValues = CredentialUtils.convertAttributesToValues(credentialAttributes)
      if (CredentialUtils.checkValuesMatch(offerValues, defaultValues)) {
        return true
      }
    }
    return false
  }

  private areCredentialValuesValid(credentialRecord: CredentialRecord) {
    if (credentialRecord.credentialAttributes && credentialRecord.credentialMessage) {
      const indyCredential = credentialRecord.credentialMessage.indyCredential

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

  private areProposalAndOfferDefinitionIdEqual(credentialRecord: CredentialRecord) {
    const proposalCredentialDefinitionId = credentialRecord.proposalMessage?.credentialDefinitionId
    const offerCredentialDefinitionId = credentialRecord.offerMessage?.indyCredentialOffer?.cred_def_id
    return proposalCredentialDefinitionId === offerCredentialDefinitionId
  }

  private isRequestDefinitionIdValid(credentialRecord: CredentialRecord) {
    if (credentialRecord.proposalMessage || credentialRecord.offerMessage) {
      const previousCredentialDefinitionId =
        credentialRecord.offerMessage?.indyCredentialOffer?.cred_def_id ??
        credentialRecord.proposalMessage?.credentialDefinitionId

      if (previousCredentialDefinitionId === credentialRecord.requestMessage?.indyCredentialRequest?.cred_def_id) {
        return true
      }
    }
    return false
  }
}
