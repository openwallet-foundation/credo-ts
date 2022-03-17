/* eslint-disable @typescript-eslint/no-unused-vars */
import type { AgentMessage } from '../../../../agent/AgentMessage'
import type { EventEmitter } from '../../../../agent/EventEmitter'
import type { Attachment } from '../../../../decorators/attachment/Attachment'
import type { ConnectionService } from '../../../connections'
import type { IndyHolderService, IndyIssuerService } from '../../../indy'
import type { IndyLedgerService } from '../../../ledger'
import type {
  AcceptCredentialOptions,
  AcceptProposalOptions,
  NegotiateProposalOptions,
  OfferCredentialOptions,
  ProposeCredentialOptions,
  RequestCredentialOptions,
} from '../../interfaces'
import type { CredentialPreviewAttribute } from '../../models/CredentialPreviewAttributes'
import type {
  ServiceAcceptOfferOptions,
  ServiceAcceptRequestOptions,
  ServiceRequestCredentialOptions,
} from '../../protocol'
import type { CredPropose } from '../../protocol/v1/models/CredentialFormatOptions'
import type { CredentialExchangeRecord } from '../../repository/CredentialExchangeRecord'
import type { CredentialRepository } from '../../repository/CredentialRepository'
import type {
  CredentialAttachmentFormats,
  CredentialFormatSpec,
  HandlerAutoAcceptOptions,
  OfferAttachmentFormats,
  ProposeAttachmentFormats,
} from '../models/CredentialFormatServiceOptions'
import type { Cred, CredOffer, CredReq, CredReqMetadata } from 'indy-sdk'

import { AriesFrameworkError } from '../../../../../src/error'
import { uuid } from '../../../../utils/uuid'
import { AutoAcceptCredential } from '../../CredentialAutoAcceptType'
import { CredentialResponseCoordinator } from '../../CredentialResponseCoordinator'
import { CredentialUtils } from '../../CredentialUtils'
import { CredentialProblemReportError, CredentialProblemReportReason } from '../../errors'
import { CredentialRecordType } from '../../interfaces'
import { V2CredentialPreview } from '../../protocol/v2/V2CredentialPreview'
import { CredentialMetadataKeys } from '../../repository/CredentialMetadataTypes'
import { CredentialFormatService } from '../CredentialFormatService'

export class IndyCredentialFormatService extends CredentialFormatService {
  private indyIssuerService: IndyIssuerService
  private indyLedgerService: IndyLedgerService
  private indyHolderService: IndyHolderService
  private connectionService: ConnectionService
  protected credentialRepository: CredentialRepository // protected as in base class

  public constructor(
    credentialRepository: CredentialRepository,
    eventEmitter: EventEmitter,
    indyIssuerService: IndyIssuerService,
    indyLedgerService: IndyLedgerService,
    indyHolderService: IndyHolderService,
    connectionService: ConnectionService
  ) {
    super(credentialRepository, eventEmitter)
    this.credentialRepository = credentialRepository
    this.indyIssuerService = indyIssuerService
    this.indyLedgerService = indyLedgerService
    this.indyHolderService = indyHolderService
    this.connectionService = connectionService
  }

  /**
   * Not implemented; there for future versions
   */
  public async processRequest(
    options: RequestCredentialOptions,
    credentialRecord: CredentialExchangeRecord
  ): Promise<void> {
    // not needed for Indy
  }

  /**
   * Process offer - just sets the metadata for now
   * @param options object containing the offer attachment for use here to retreive the actual cred offer
   * @param credentialRecord the credential exchange record for this offer
   */
  public async processOffer(options: AcceptProposalOptions, credentialRecord: CredentialExchangeRecord): Promise<void> {
    if (options.offerAttachment) {
      const credOffer: CredOffer = options.offerAttachment.getDataAsJson<CredOffer>()

      credentialRecord.metadata.set(CredentialMetadataKeys.IndyCredential, {
        schemaId: credOffer.schema_id,
        credentialDefinitionId: credOffer.cred_def_id,
      })
    } else {
      throw new AriesFrameworkError('Missing offer attachment in processOffer')
    }
  }
  /**
   * Create a {@link AttachmentFormats} object dependent on the message type.
   *
   * @param options The object containing all the options for the proposed credential
   * @param messageType the type of message which can be Indy, JsonLd etc eg "CRED_20_PROPOSAL"
   * @returns object containing associated attachment, formats and filtersAttach elements
   *
   */
  public createProposal(options: ProposeCredentialOptions): ProposeAttachmentFormats {
    const formats: CredentialFormatSpec = {
      attachId: this.generateId(),
      format: 'hlindy/cred-filter@v2.0',
    }

    if (options.credentialFormats.indy?.payload && options.credentialFormats.indy?.payload) {
      const attachment: Attachment = this.getFormatData(
        options.credentialFormats.indy?.payload.credentialPayload,
        formats.attachId
      )
      const { previewWithAttachments } = this.getCredentialLinkedAttachments(options)

      return { format: formats, attachment, preview: previewWithAttachments }
    }
    throw new AriesFrameworkError('Missing payload in createProposal')
  }

  /**
   * Create a {@link AttachmentFormats} object dependent on the message type.
   *
   * @param proposal The object containing all the options for the credential offer
   * @param messageType the type of message which can be Indy, JsonLd etc eg "CRED_20_OFFER"
   * @returns object containing associated attachment, formats and offersAttach elements
   *
   */
  public async createOffer(proposal: ServiceAcceptOfferOptions): Promise<OfferAttachmentFormats> {
    const formats: CredentialFormatSpec = {
      attachId: this.generateId(),
      format: 'hlindy/cred-abstract@v2.0',
    }
    const offer = await this.createCredentialOffer(proposal)

    let preview: V2CredentialPreview | undefined

    if (proposal?.credentialFormats.indy?.attributes) {
      preview = new V2CredentialPreview({
        attributes: proposal?.credentialFormats.indy?.attributes,
      })
    }
    // if the proposal has an attachment Id use that, otherwise the generated id of the formats object
    const attachmentId = proposal.attachId ? proposal.attachId : formats.attachId

    const offersAttach: Attachment = this.getFormatData(offer, attachmentId)

    return { format: formats, attachment: offersAttach, preview }
  }
  /**
   * Create a {@link AttachmentFormats} object dependent on the message type.
   *
   * @param requestOptions The object containing all the options for the credential request
   * @param credentialRecord the credential record containing the offer from which this request
   * is derived
   * @returns object containing associated attachment, formats and requestAttach elements
   *
   */
  public async createRequest(
    options: ServiceRequestCredentialOptions,
    credentialRecord: CredentialExchangeRecord
  ): Promise<CredentialAttachmentFormats> {
    if (options.offerAttachment) {
      const offer = options.offerAttachment.getDataAsJson<CredOffer>()

      // format service -> get the credential definition and create the [indy] credential request
      options.credentialDefinition = await this.getCredentialDefinition(offer)

      const { credReq, credReqMetadata } = await this.createIndyCredentialRequest(options, offer)
      credentialRecord.metadata.set(CredentialMetadataKeys.IndyRequest, credReqMetadata)

      const formats: CredentialFormatSpec = {
        attachId: this.generateId(),
        format: 'hlindy/cred-req@v2.0',
      }

      const attachmentId = options.attachId ?? formats.attachId
      const requestAttach: Attachment = this.getFormatData(credReq, attachmentId)
      return { format: formats, attachment: requestAttach }
    } else {
      throw new AriesFrameworkError(
        `Missing attachment from offer message, credential record id = ${credentialRecord.id}`
      )
    }
  }

  private async getCredentialDefinition(credOffer: CredOffer) {
    const indyCredDef = await this.indyLedgerService.getCredentialDefinition(credOffer.cred_def_id)
    return {
      indy: {
        credDef: indyCredDef,
      },
    }
  }

  /**
   * Get linked attachments for indy format from a proposal message. This allows attachments
   * to be copied across to old style credential records
   *
   * @param options ProposeCredentialOptions object containing (optionally) the linked attachments
   * @return array of linked attachments or undefined if none present
   */
  private getCredentialLinkedAttachments(options: ProposeCredentialOptions): {
    attachments: Attachment[] | undefined
    previewWithAttachments: V2CredentialPreview
  } {
    // Add the linked attachments to the credentialProposal
    let credPropose: CredPropose
    if (options.credentialFormats.indy?.payload && options.credentialFormats.indy?.payload) {
      credPropose = options.credentialFormats.indy?.payload.credentialPayload as CredPropose

      let attachments: Attachment[] | undefined
      let previewWithAttachments: V2CredentialPreview = new V2CredentialPreview({
        attributes: credPropose.attributes ? credPropose.attributes : [],
      })

      if (options.credentialFormats.indy && credPropose.linkedAttachments) {
        // there are linked attachments so transform into the attribute field of the CredentialPreview object for
        // this proposal
        if (credPropose.attributes && credPropose.credentialDefinitionId) {
          previewWithAttachments = CredentialUtils.createAndLinkAttachmentsToPreview(
            credPropose.linkedAttachments,
            new V2CredentialPreview({
              attributes: credPropose.attributes,
            })
          )
        }
        attachments = credPropose.linkedAttachments.map((linkedAttachment) => linkedAttachment.attachment)

        credPropose.credentialDefinitionId = this.getCredentialDefinitionId(options)

        options.credentialFormats.indy.payload.credentialPayload = credPropose
      }
      return { attachments, previewWithAttachments }
    }
    throw new AriesFrameworkError('Missing payload in getCredentialLinkedAttachments')
  }

  /**
   *
   * @param options Gets the credential definition id if present for an indy credential
   * @returns the credential definition id for this credential
   */
  private getCredentialDefinitionId(options: ProposeCredentialOptions): string | undefined {
    if (options.credentialFormats.indy?.payload && options.credentialFormats.indy?.payload) {
      const credPropose: CredPropose = options.credentialFormats.indy?.payload.credentialPayload as CredPropose
      return credPropose.credentialDefinitionId
    }
  }

  /**
   * Gets the attachment object for a given attachId. We need to get out the correct attachId for
   * indy and then find the corresponding attachment (if there is one)
   * @param message Gets the
   * @returns The Attachment if found or undefined
   */
  public getAttachment(message: AgentMessage): Attachment | undefined {
    const formatId = message.formats.find((f) => f.format.includes('indy'))
    const attachment = message.messageAttachment?.find((attachment) => attachment.id === formatId?.attachId)
    return attachment
  }

  /**
   * Create a credential offer for the given credential definition id.
   *
   * @param credentialDefinitionId The credential definition to create an offer for
   * @returns The created credential offer
   */
  private async createCredentialOffer(
    proposal: ServiceAcceptOfferOptions | NegotiateProposalOptions | OfferCredentialOptions
  ): Promise<CredOffer> {
    if (this.indyIssuerService && proposal.credentialFormats?.indy?.credentialDefinitionId) {
      const credOffer: CredOffer = await this.indyIssuerService.createCredentialOffer(
        proposal.credentialFormats.indy.credentialDefinitionId
      )
      return credOffer
    }
    if (!this.indyIssuerService) {
      throw new AriesFrameworkError('Missing Indy Issuer Service')
    } else {
      throw new AriesFrameworkError('Missing Credential Definition id')
    }
  }

  /**
   * Create a credential offer for the given credential definition id.
   *
   * @param options RequestCredentialOptions the config options for the credential request
   * @throws Error if unable to create the request
   * @returns The created credential offer
   */
  private async createIndyCredentialRequest(
    options: RequestCredentialOptions,
    offer: CredOffer
  ): Promise<{ credReq: CredReq; credReqMetadata: CredReqMetadata }> {
    if (this.indyHolderService && options.credentialDefinition && options.credentialDefinition.indy?.credDef) {
      const [credReq, credReqMetadata] = await this.indyHolderService.createCredentialRequest({
        holderDid: options.holderDid,
        credentialOffer: offer,
        credentialDefinition: options.credentialDefinition.indy?.credDef,
      })
      return { credReq, credReqMetadata }
    }
    throw new AriesFrameworkError('Unable to create Credential Request')
  }

  public async processProposal(
    options: AcceptProposalOptions,
    credentialRecord: CredentialExchangeRecord
  ): Promise<AcceptProposalOptions> {
    let credPropose: CredPropose | undefined
    if (options.proposalAttachment) {
      credPropose = options.proposalAttachment.getDataAsJson<CredPropose>()
      if (credPropose) {
        credentialRecord.metadata.set(CredentialMetadataKeys.IndyCredential, {
          schemaId: credPropose.schemaId,
          credentialDefinitionId: credPropose.credentialDefinitionId,
        })
      } else {
        throw new AriesFrameworkError(`Missing data payload in attachment in credential Record ${credentialRecord.id}`)
      }

      options.credentialFormats = {
        indy: {
          attributes: credentialRecord.credentialAttributes,
          credentialDefinitionId: credPropose?.credentialDefinitionId,
        },
      }
      return options
    }

    throw new AriesFrameworkError('Unable to create accept proposal options object')
  }

  /**
   * Create a {@link AttachmentFormats} object dependent on the message type.
   *
   * @param requestOptions The object containing all the options for the credential request
   * @param credentialRecord the credential record containing the offer from which this request
   * is derived
   * @returns object containing associated attachment, formats and requestAttach elements
   *
   */
  public async createCredential(
    options: ServiceAcceptRequestOptions,
    record: CredentialExchangeRecord
  ): Promise<CredentialAttachmentFormats> {
    // Assert credential attributes
    const credentialAttributes = record.credentialAttributes
    if (!credentialAttributes) {
      throw new CredentialProblemReportError(
        `Missing required credential attribute values on credential record with id ${record.id}`,
        { problemCode: CredentialProblemReportReason.IssuanceAbandoned }
      )
    }

    let credOffer: CredOffer | undefined
    let credRequest: CredReq | undefined
    if (options.offerAttachment) {
      credOffer = options.offerAttachment.getDataAsJson<CredOffer>()
    }
    if (options.requestAttachment) {
      credRequest = options.requestAttachment.getDataAsJson<CredReq>()
    }

    if (credOffer && credRequest) {
      if (this.indyIssuerService) {
        const [credential] = await this.indyIssuerService.createCredential({
          credentialOffer: credOffer,
          credentialRequest: credRequest,
          credentialValues: CredentialUtils.convertAttributesToValues(credentialAttributes),
        })

        const formats: CredentialFormatSpec = {
          attachId: this.generateId(),
          format: 'hlindy/cred-abstract@v2.0',
        }

        const attachmentId = options.attachId ? options.attachId : formats.attachId
        const issueAttachment: Attachment = this.getFormatData(credential, attachmentId)
        return { format: formats, attachment: issueAttachment }
      }
    }
    throw new AriesFrameworkError('Missing CredOffer or CredReq for createIssueCredentialAttachFormats')
  }
  /**
   * Processes an incoming credential - retreive metadata, retrievepayload and store it in the Indy wallet
   * @param message the issue credential message
   */

  /**
   * Processes an incoming credential - retreive metadata, retrievepayload and store it in the Indy wallet
   * @param options the issue credential message wrapped inside this object
   * @param credentialRecord the credential exchange record for this credential
   */
  public async processCredential(
    options: AcceptCredentialOptions,
    credentialRecord: CredentialExchangeRecord
  ): Promise<void> {
    const credentialRequestMetadata = credentialRecord.metadata.get(CredentialMetadataKeys.IndyRequest)

    if (!credentialRequestMetadata) {
      throw new CredentialProblemReportError(
        `Missing required request metadata for credential with id ${credentialRecord.id}`,
        { problemCode: CredentialProblemReportReason.IssuanceAbandoned }
      )
    }
    if (options.credential) {
      const indyCredential: Cred = options.credential.getDataAsJson<Cred>()

      const credentialDefinition = await this.indyLedgerService.getCredentialDefinition(indyCredential.cred_def_id)

      if (!this.indyHolderService) {
        throw new CredentialProblemReportError(
          `Missing required indy holder service for credential with record id ${credentialRecord.id}`,
          { problemCode: CredentialProblemReportReason.IssuanceAbandoned }
        )
      }
      const credentialId = await this.indyHolderService.storeCredential({
        credentialId: this.generateId(),
        credentialRequestMetadata,
        credential: indyCredential,
        credentialDefinition,
      })
      credentialRecord.credentials.push({
        credentialRecordType: CredentialRecordType.Indy,
        credentialRecordId: credentialId,
      })
    } else {
      throw new AriesFrameworkError(`Missing credential for record id ${credentialRecord.id}`)
    }
  }

  /**
   * Checks whether it should automatically respond to a proposal. Moved from CredentialResponseCoordinator
   * as this contains format-specific logic
   * @param credentialRecord The credential record for which we are testing whether or not to auto respond
   * @param agentConfig config object for the agent, used to hold auto accept state for the agent
   * @returns true if we should auto respond, false otherwise
   */

  public shouldAutoRespondToProposal(handlerOptions: HandlerAutoAcceptOptions): boolean {
    const autoAccept = CredentialResponseCoordinator.composeAutoAccept(
      handlerOptions.credentialRecord.autoAcceptCredential,
      handlerOptions.autoAcceptType
    )

    if (autoAccept === AutoAcceptCredential.Always) {
      return true
    } else if (autoAccept === AutoAcceptCredential.ContentApproved) {
      return (
        this.areProposalValuesValid(handlerOptions.credentialRecord, handlerOptions.messageAttributes) &&
        this.areProposalAndOfferDefinitionIdEqual(handlerOptions.proposalAttachment, handlerOptions.offerAttachment)
      )
    }
    return false
  }

  /**
 * Checks whether it should automatically respond to a request. Moved from CredentialResponseCoordinator
 * as this contains format-specific logic
 * @param credentialRecord The credential record for which we are testing whether or not to auto respond
 * @param autoAcceptType auto accept type for this credential exchange - normal auto or content approved
 * @returns true if we should auto respond, false otherwise

 */

  public shouldAutoRespondToRequest(options: HandlerAutoAcceptOptions): boolean {
    const autoAccept = CredentialResponseCoordinator.composeAutoAccept(
      options.credentialRecord.autoAcceptCredential,
      options.autoAcceptType
    )

    if (!options.requestAttachment) {
      throw new AriesFrameworkError(`Missing Request Attachment for Credential Record ${options.credentialRecord.id}`)
    }
    if (autoAccept === AutoAcceptCredential.Always) {
      return true
    } else if (autoAccept === AutoAcceptCredential.ContentApproved) {
      return this.isRequestDefinitionIdValid(
        options.requestAttachment,
        options.offerAttachment,
        options.proposalAttachment
      )
    }
    return false
  }
  /**
   * Checks whether it should automatically respond to a request. Moved from CredentialResponseCoordinator
   * as this contains format-specific logic
   * @param credentialRecord The credential record for which we are testing whether or not to auto respond
   * @param autoAcceptType auto accept type for this credential exchange - normal auto or content approved
   * @returns true if we should auto respond, false otherwise
   */

  public shouldAutoRespondToCredential(options: HandlerAutoAcceptOptions): boolean {
    const autoAccept = CredentialResponseCoordinator.composeAutoAccept(
      options.credentialRecord.autoAcceptCredential,
      options.autoAcceptType
    )

    if (autoAccept === AutoAcceptCredential.Always) {
      return true
    } else if (autoAccept === AutoAcceptCredential.ContentApproved) {
      if (options.credentialAttachment) {
        return this.areCredentialValuesValid(options.credentialRecord, options.credentialAttachment)
      }
    }
    return false
  }
  private areProposalValuesValid(
    credentialRecord: CredentialExchangeRecord,
    proposeMessageAttributes?: CredentialPreviewAttribute[]
  ) {
    const { credentialAttributes } = credentialRecord

    if (proposeMessageAttributes && credentialAttributes) {
      const proposeValues = CredentialUtils.convertAttributesToValues(proposeMessageAttributes)
      const defaultValues = CredentialUtils.convertAttributesToValues(credentialAttributes)
      if (CredentialUtils.checkValuesMatch(proposeValues, defaultValues)) {
        return true
      }
    }
    return false
  }

  private areProposalAndOfferDefinitionIdEqual(proposalAttachment?: Attachment, offerAttachment?: Attachment) {
    let credOffer: CredOffer | undefined
    let credPropose: CredPropose | undefined

    if (offerAttachment) {
      credOffer = offerAttachment.getDataAsJson<CredOffer>()
    }
    if (proposalAttachment) {
      credPropose = proposalAttachment?.getDataAsJson<CredPropose>()
    }

    const proposalCredentialDefinitionId = credPropose?.credentialDefinitionId
    const offerCredentialDefinitionId = credOffer?.cred_def_id

    return proposalCredentialDefinitionId === offerCredentialDefinitionId
  }
  private areCredentialValuesValid(credentialRecord: CredentialExchangeRecord, credentialAttachment: Attachment) {
    const indyCredential = credentialAttachment.getDataAsJson<Cred>()

    if (!indyCredential) {
      new AriesFrameworkError(`Missing required base64 encoded attachment data for credential`)
      return false
    }

    const credentialMessageValues = indyCredential.values

    if (credentialRecord.credentialAttributes) {
      const defaultValues = CredentialUtils.convertAttributesToValues(credentialRecord.credentialAttributes)

      if (CredentialUtils.checkValuesMatch(credentialMessageValues, defaultValues)) {
        return true
      }
    }
    return false
  }

  private isRequestDefinitionIdValid(
    requestAttachment: Attachment,
    offerAttachment?: Attachment,
    proposeAttachment?: Attachment
  ) {
    const indyCredentialRequest = requestAttachment?.getDataAsJson<CredReq>()
    const indyCredentialProposal = proposeAttachment?.getDataAsJson<CredPropose>()
    const indyCredentialOffer = offerAttachment?.getDataAsJson<CredOffer>()

    if (indyCredentialProposal || indyCredentialOffer) {
      const previousCredentialDefinitionId =
        indyCredentialOffer?.cred_def_id ?? indyCredentialProposal?.credentialDefinitionId

      if (previousCredentialDefinitionId === indyCredentialRequest.cred_def_id) {
        return true
      }
      return false
    }
    return false
  }
  private generateId(): string {
    return uuid()
  }
}
