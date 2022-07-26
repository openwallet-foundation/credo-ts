import type { AgentContext } from '../../../../agent'
import type { Attachment } from '../../../../decorators/attachment/Attachment'
import type { LinkedAttachment } from '../../../../utils/LinkedAttachment'
import type { CredentialPreviewAttributeOptions } from '../../models/CredentialPreviewAttribute'
import type { CredentialExchangeRecord } from '../../repository/CredentialExchangeRecord'
import type {
  FormatAcceptOfferOptions,
  FormatAcceptProposalOptions,
  FormatAcceptRequestOptions,
  FormatAutoRespondCredentialOptions,
  FormatAutoRespondOfferOptions,
  FormatAutoRespondProposalOptions,
  FormatAutoRespondRequestOptions,
  FormatCreateOfferOptions,
  FormatCreateOfferReturn,
  FormatCreateProposalOptions,
  FormatCreateProposalReturn,
  FormatCreateReturn,
  FormatProcessOptions,
} from '../CredentialFormatServiceOptions'
import type { IndyCredentialFormat } from './IndyCredentialFormat'
import type * as Indy from 'indy-sdk'

import { EventEmitter } from '../../../../agent/EventEmitter'
import { InjectionSymbols } from '../../../../constants'
import { AriesFrameworkError } from '../../../../error'
import { Logger } from '../../../../logger'
import { inject, injectable } from '../../../../plugins'
import { JsonTransformer } from '../../../../utils/JsonTransformer'
import { MessageValidator } from '../../../../utils/MessageValidator'
import { getIndyDidFromVerificationMethod } from '../../../../utils/did'
import { uuid } from '../../../../utils/uuid'
import { ConnectionService } from '../../../connections'
import { DidResolverService, findVerificationMethodByKeyType } from '../../../dids'
import { IndyHolderService, IndyIssuerService } from '../../../indy'
import { IndyLedgerService } from '../../../ledger'
import { CredentialProblemReportError, CredentialProblemReportReason } from '../../errors'
import { CredentialFormatSpec } from '../../models/CredentialFormatSpec'
import { CredentialPreviewAttribute } from '../../models/CredentialPreviewAttribute'
import { CredentialMetadataKeys } from '../../repository/CredentialMetadataTypes'
import { CredentialRepository } from '../../repository/CredentialRepository'
import { CredentialFormatService } from '../CredentialFormatService'

import { IndyCredentialUtils } from './IndyCredentialUtils'
import { IndyCredPropose } from './models/IndyCredPropose'

const INDY_CRED_ABSTRACT = 'hlindy/cred-abstract@v2.0'
const INDY_CRED_REQUEST = 'hlindy/cred-req@v2.0'
const INDY_CRED_FILTER = 'hlindy/cred-filter@v2.0'
const INDY_CRED = 'hlindy/cred@v2.0'

@injectable()
export class IndyCredentialFormatService extends CredentialFormatService<IndyCredentialFormat> {
  private indyIssuerService: IndyIssuerService
  private indyLedgerService: IndyLedgerService
  private indyHolderService: IndyHolderService
  private connectionService: ConnectionService
  private didResolver: DidResolverService
  private logger: Logger

  public constructor(
    credentialRepository: CredentialRepository,
    eventEmitter: EventEmitter,
    indyIssuerService: IndyIssuerService,
    indyLedgerService: IndyLedgerService,
    indyHolderService: IndyHolderService,
    connectionService: ConnectionService,
    didResolver: DidResolverService,
    @inject(InjectionSymbols.Logger) logger: Logger
  ) {
    super(credentialRepository, eventEmitter)
    this.indyIssuerService = indyIssuerService
    this.indyLedgerService = indyLedgerService
    this.indyHolderService = indyHolderService
    this.connectionService = connectionService
    this.didResolver = didResolver
    this.logger = logger
  }

  public readonly formatKey = 'indy' as const
  public readonly credentialRecordType = 'indy' as const

  /**
   * Create a {@link AttachmentFormats} object dependent on the message type.
   *
   * @param options The object containing all the options for the proposed credential
   * @returns object containing associated attachment, format and optionally the credential preview
   *
   */
  public async createProposal(
    agentContext: AgentContext,
    { credentialFormats, credentialRecord }: FormatCreateProposalOptions<IndyCredentialFormat>
  ): Promise<FormatCreateProposalReturn> {
    const format = new CredentialFormatSpec({
      format: INDY_CRED_FILTER,
    })

    const indyFormat = credentialFormats.indy

    if (!indyFormat) {
      throw new AriesFrameworkError('Missing indy payload in createProposal')
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { attributes, linkedAttachments, ...indyCredentialProposal } = indyFormat

    const proposal = new IndyCredPropose(indyCredentialProposal)

    try {
      MessageValidator.validateSync(proposal)
    } catch (error) {
      throw new AriesFrameworkError(`Invalid proposal supplied: ${indyCredentialProposal} in Indy Format Service`)
    }

    const proposalJson = JsonTransformer.toJSON(proposal)
    const attachment = this.getFormatData(proposalJson, format.attachId)

    const { previewAttributes } = this.getCredentialLinkedAttachments(
      indyFormat.attributes,
      indyFormat.linkedAttachments
    )

    // Set the metadata
    credentialRecord.metadata.set(CredentialMetadataKeys.IndyCredential, {
      schemaId: proposal.schemaId,
      credentialDefinitionId: proposal.credentialDefinitionId,
    })

    return { format, attachment, previewAttributes }
  }

  public async processProposal(agentContext: AgentContext, { attachment }: FormatProcessOptions): Promise<void> {
    const credProposalJson = attachment.getDataAsJson()

    if (!credProposalJson) {
      throw new AriesFrameworkError('Missing indy credential proposal data payload')
    }

    const credProposal = JsonTransformer.fromJSON(credProposalJson, IndyCredPropose)
    MessageValidator.validateSync(credProposal)
  }

  public async acceptProposal(
    agentContext: AgentContext,
    {
      attachId,
      credentialFormats,
      credentialRecord,
      proposalAttachment,
    }: FormatAcceptProposalOptions<IndyCredentialFormat>
  ): Promise<FormatCreateOfferReturn> {
    const indyFormat = credentialFormats?.indy

    const credentialProposal = JsonTransformer.fromJSON(proposalAttachment.getDataAsJson(), IndyCredPropose)

    const credentialDefinitionId = indyFormat?.credentialDefinitionId ?? credentialProposal.credentialDefinitionId
    const attributes = indyFormat?.attributes ?? credentialRecord.credentialAttributes

    if (!credentialDefinitionId) {
      throw new AriesFrameworkError(
        'No credentialDefinitionId in proposal or provided as input to accept proposal method.'
      )
    }

    if (!attributes) {
      throw new AriesFrameworkError('No attributes in proposal or provided as input to accept proposal method.')
    }

    const { format, attachment, previewAttributes } = await this.createIndyOffer(agentContext, {
      credentialRecord,
      attachId,
      attributes,
      credentialDefinitionId: credentialDefinitionId,
      linkedAttachments: indyFormat?.linkedAttachments,
    })

    return { format, attachment, previewAttributes }
  }

  /**
   * Create a credential attachment format for a credential request.
   *
   * @param options The object containing all the options for the credential offer
   * @returns object containing associated attachment, formats and offersAttach elements
   *
   */
  public async createOffer(
    agentContext: AgentContext,
    { credentialFormats, credentialRecord, attachId }: FormatCreateOfferOptions<IndyCredentialFormat>
  ): Promise<FormatCreateOfferReturn> {
    const indyFormat = credentialFormats.indy

    if (!indyFormat) {
      throw new AriesFrameworkError('Missing indy credentialFormat data')
    }

    const { format, attachment, previewAttributes } = await this.createIndyOffer(agentContext, {
      credentialRecord,
      attachId,
      attributes: indyFormat.attributes,
      credentialDefinitionId: indyFormat.credentialDefinitionId,
      linkedAttachments: indyFormat.linkedAttachments,
    })

    return { format, attachment, previewAttributes }
  }

  public async processOffer(agentContext: AgentContext, { attachment, credentialRecord }: FormatProcessOptions) {
    this.logger.debug(`Processing indy credential offer for credential record ${credentialRecord.id}`)

    const credOffer = attachment.getDataAsJson<Indy.CredOffer>()

    if (!credOffer.schema_id || !credOffer.cred_def_id) {
      throw new CredentialProblemReportError('Invalid credential offer', {
        problemCode: CredentialProblemReportReason.IssuanceAbandoned,
      })
    }
  }

  public async acceptOffer(
    agentContext: AgentContext,
    { credentialFormats, credentialRecord, attachId, offerAttachment }: FormatAcceptOfferOptions<IndyCredentialFormat>
  ): Promise<FormatCreateReturn> {
    const indyFormat = credentialFormats?.indy

    const holderDid = indyFormat?.holderDid ?? (await this.getIndyHolderDid(agentContext, credentialRecord))

    const credentialOffer = offerAttachment.getDataAsJson<Indy.CredOffer>()
    const credentialDefinition = await this.indyLedgerService.getCredentialDefinition(
      agentContext,
      credentialOffer.cred_def_id
    )

    const [credentialRequest, credentialRequestMetadata] = await this.indyHolderService.createCredentialRequest(
      agentContext,
      {
        holderDid,
        credentialOffer,
        credentialDefinition,
      }
    )
    credentialRecord.metadata.set(CredentialMetadataKeys.IndyRequest, credentialRequestMetadata)
    credentialRecord.metadata.set(CredentialMetadataKeys.IndyCredential, {
      credentialDefinitionId: credentialOffer.cred_def_id,
      schemaId: credentialOffer.schema_id,
    })

    const format = new CredentialFormatSpec({
      attachId,
      format: INDY_CRED_REQUEST,
    })

    const attachment = this.getFormatData(credentialRequest, format.attachId)
    return { format, attachment }
  }

  /**
   * Starting from a request is not supported for indy credentials, this method only throws an error.
   */
  public async createRequest(): Promise<FormatCreateReturn> {
    throw new AriesFrameworkError('Starting from a request is not supported for indy credentials')
  }

  /**
   * We don't have any models to validate an indy request object, for now this method does nothing
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async processRequest(agentContext: AgentContext, options: FormatProcessOptions): Promise<void> {
    // not needed for Indy
  }

  public async acceptRequest(
    agentContext: AgentContext,
    { credentialRecord, attachId, offerAttachment, requestAttachment }: FormatAcceptRequestOptions<IndyCredentialFormat>
  ): Promise<FormatCreateReturn> {
    // Assert credential attributes
    const credentialAttributes = credentialRecord.credentialAttributes
    if (!credentialAttributes) {
      throw new CredentialProblemReportError(
        `Missing required credential attribute values on credential record with id ${credentialRecord.id}`,
        { problemCode: CredentialProblemReportReason.IssuanceAbandoned }
      )
    }

    const credentialOffer = offerAttachment?.getDataAsJson<Indy.CredOffer>()
    const credentialRequest = requestAttachment.getDataAsJson<Indy.CredReq>()

    if (!credentialOffer || !credentialRequest) {
      throw new AriesFrameworkError('Missing indy credential offer or credential request in createCredential')
    }

    const [credential, credentialRevocationId] = await this.indyIssuerService.createCredential(agentContext, {
      credentialOffer,
      credentialRequest,
      credentialValues: IndyCredentialUtils.convertAttributesToValues(credentialAttributes),
    })

    if (credential.rev_reg_id) {
      credentialRecord.metadata.add(CredentialMetadataKeys.IndyCredential, {
        indyCredentialRevocationId: credentialRevocationId,
        indyRevocationRegistryId: credential.rev_reg_id,
      })
    }

    const format = new CredentialFormatSpec({
      attachId,
      format: INDY_CRED,
    })

    const attachment = this.getFormatData(credential, format.attachId)
    return { format, attachment }
  }

  /**
   * Processes an incoming credential - retrieve metadata, retrieve payload and store it in the Indy wallet
   * @param options the issue credential message wrapped inside this object
   * @param credentialRecord the credential exchange record for this credential
   */
  public async processCredential(
    agentContext: AgentContext,
    { credentialRecord, attachment }: FormatProcessOptions
  ): Promise<void> {
    const credentialRequestMetadata = credentialRecord.metadata.get(CredentialMetadataKeys.IndyRequest)

    if (!credentialRequestMetadata) {
      throw new CredentialProblemReportError(
        `Missing required request metadata for credential with id ${credentialRecord.id}`,
        { problemCode: CredentialProblemReportReason.IssuanceAbandoned }
      )
    }

    const indyCredential = attachment.getDataAsJson<Indy.Cred>()
    const credentialDefinition = await this.indyLedgerService.getCredentialDefinition(
      agentContext,
      indyCredential.cred_def_id
    )
    const revocationRegistry = indyCredential.rev_reg_id
      ? await this.indyLedgerService.getRevocationRegistryDefinition(agentContext, indyCredential.rev_reg_id)
      : null

    if (!credentialRecord.credentialAttributes) {
      throw new AriesFrameworkError(
        'Missing credential attributes on credential record. Unable to check credential attributes'
      )
    }

    // assert the credential values match the offer values
    const recordCredentialValues = IndyCredentialUtils.convertAttributesToValues(credentialRecord.credentialAttributes)
    IndyCredentialUtils.assertValuesMatch(indyCredential.values, recordCredentialValues)

    const credentialId = await this.indyHolderService.storeCredential(agentContext, {
      credentialId: uuid(),
      credentialRequestMetadata,
      credential: indyCredential,
      credentialDefinition,
      revocationRegistryDefinition: revocationRegistry?.revocationRegistryDefinition,
    })

    // If the credential is revocable, store the revocation identifiers in the credential record
    if (indyCredential.rev_reg_id) {
      const credential = await this.indyHolderService.getCredential(agentContext, credentialId)

      credentialRecord.metadata.add(CredentialMetadataKeys.IndyCredential, {
        indyCredentialRevocationId: credential.cred_rev_id,
        indyRevocationRegistryId: indyCredential.rev_reg_id,
      })
    }

    credentialRecord.credentials.push({
      credentialRecordType: this.credentialRecordType,
      credentialRecordId: credentialId,
    })
  }

  public supportsFormat(format: string): boolean {
    const supportedFormats = [INDY_CRED_ABSTRACT, INDY_CRED_REQUEST, INDY_CRED_FILTER, INDY_CRED]

    return supportedFormats.includes(format)
  }

  /**
   * Gets the attachment object for a given attachId. We need to get out the correct attachId for
   * indy and then find the corresponding attachment (if there is one)
   * @param formats the formats object containing the attachId
   * @param messageAttachments the attachments containing the payload
   * @returns The Attachment if found or undefined
   *
   */
  public getAttachment(formats: CredentialFormatSpec[], messageAttachments: Attachment[]): Attachment | undefined {
    const supportedAttachmentIds = formats.filter((f) => this.supportsFormat(f.format)).map((f) => f.attachId)
    const supportedAttachments = messageAttachments.filter((attachment) =>
      supportedAttachmentIds.includes(attachment.id)
    )

    return supportedAttachments[0]
  }

  public async deleteCredentialById(agentContext: AgentContext, credentialRecordId: string): Promise<void> {
    await this.indyHolderService.deleteCredential(agentContext, credentialRecordId)
  }

  public shouldAutoRespondToProposal(
    agentContext: AgentContext,
    { offerAttachment, proposalAttachment }: FormatAutoRespondProposalOptions
  ) {
    const credentialProposalJson = proposalAttachment.getDataAsJson()
    const credentialProposal = JsonTransformer.fromJSON(credentialProposalJson, IndyCredPropose)

    const credentialOfferJson = offerAttachment.getDataAsJson<Indy.CredOffer>()

    // We want to make sure the credential definition matches.
    // TODO: If no credential definition is present on the proposal, we could check whether the other fields
    // of the proposal match with the credential definition id.
    return credentialProposal.credentialDefinitionId === credentialOfferJson.cred_def_id
  }

  public shouldAutoRespondToOffer(
    agentContext: AgentContext,
    { offerAttachment, proposalAttachment }: FormatAutoRespondOfferOptions
  ) {
    const credentialProposalJson = proposalAttachment.getDataAsJson()
    const credentialProposal = JsonTransformer.fromJSON(credentialProposalJson, IndyCredPropose)

    const credentialOfferJson = offerAttachment.getDataAsJson<Indy.CredOffer>()

    // We want to make sure the credential definition matches.
    // TODO: If no credential definition is present on the proposal, we could check whether the other fields
    // of the proposal match with the credential definition id.
    return credentialProposal.credentialDefinitionId === credentialOfferJson.cred_def_id
  }

  public shouldAutoRespondToRequest(
    agentContext: AgentContext,
    { offerAttachment, requestAttachment }: FormatAutoRespondRequestOptions
  ) {
    const credentialOfferJson = offerAttachment.getDataAsJson<Indy.CredOffer>()
    const credentialRequestJson = requestAttachment.getDataAsJson<Indy.CredReq>()

    return credentialOfferJson.cred_def_id == credentialRequestJson.cred_def_id
  }

  public shouldAutoRespondToCredential(
    agentContext: AgentContext,
    { credentialRecord, requestAttachment, credentialAttachment }: FormatAutoRespondCredentialOptions
  ) {
    const credentialJson = credentialAttachment.getDataAsJson<Indy.Cred>()
    const credentialRequestJson = requestAttachment.getDataAsJson<Indy.CredReq>()

    // make sure the credential definition matches
    if (credentialJson.cred_def_id !== credentialRequestJson.cred_def_id) return false

    // If we don't have any attributes stored we can't compare so always return false.
    if (!credentialRecord.credentialAttributes) return false
    const attributeValues = IndyCredentialUtils.convertAttributesToValues(credentialRecord.credentialAttributes)

    // check whether the values match the values in the record
    return IndyCredentialUtils.checkValuesMatch(attributeValues, credentialJson.values)
  }

  private async createIndyOffer(
    agentContext: AgentContext,
    {
      credentialRecord,
      attachId,
      credentialDefinitionId,
      attributes,
      linkedAttachments,
    }: {
      credentialDefinitionId: string
      credentialRecord: CredentialExchangeRecord
      attachId?: string
      attributes: CredentialPreviewAttributeOptions[]
      linkedAttachments?: LinkedAttachment[]
    }
  ): Promise<FormatCreateOfferReturn> {
    // if the proposal has an attachment Id use that, otherwise the generated id of the formats object
    const format = new CredentialFormatSpec({
      attachId: attachId,
      format: INDY_CRED_ABSTRACT,
    })

    const offer = await this.indyIssuerService.createCredentialOffer(agentContext, credentialDefinitionId)

    const { previewAttributes } = this.getCredentialLinkedAttachments(attributes, linkedAttachments)
    if (!previewAttributes) {
      throw new AriesFrameworkError('Missing required preview attributes for indy offer')
    }

    await this.assertPreviewAttributesMatchSchemaAttributes(agentContext, offer, previewAttributes)

    credentialRecord.metadata.set(CredentialMetadataKeys.IndyCredential, {
      schemaId: offer.schema_id,
      credentialDefinitionId: offer.cred_def_id,
    })

    const attachment = this.getFormatData(offer, format.attachId)

    return { format, attachment, previewAttributes }
  }

  private async assertPreviewAttributesMatchSchemaAttributes(
    agentContext: AgentContext,
    offer: Indy.CredOffer,
    attributes: CredentialPreviewAttribute[]
  ): Promise<void> {
    const schema = await this.indyLedgerService.getSchema(agentContext, offer.schema_id)

    IndyCredentialUtils.checkAttributesMatch(schema, attributes)
  }

  private async getIndyHolderDid(agentContext: AgentContext, credentialRecord: CredentialExchangeRecord) {
    // If we have a connection id we try to extract the did from the connection did document.
    if (credentialRecord.connectionId) {
      const connection = await this.connectionService.getById(agentContext, credentialRecord.connectionId)
      if (!connection.did) {
        throw new AriesFrameworkError(`Connection record ${connection.id} has no 'did'`)
      }
      const resolved = await this.didResolver.resolve(agentContext, connection.did)

      if (resolved.didDocument) {
        const verificationMethod = await findVerificationMethodByKeyType(
          'Ed25519VerificationKey2018',
          resolved.didDocument
        )

        if (verificationMethod) {
          return getIndyDidFromVerificationMethod(verificationMethod)
        }
      }
    }

    // If it wasn't successful to extract the did from the connection, we'll create a new key (e.g. if using connection-less)
    // FIXME: we already create a did for the exchange when using connection-less, but this is on a higher level. We should look at
    // a way to reuse this key, but for now this is easier.
    const { did } = await agentContext.wallet.createDid()

    return did
  }

  /**
   * Get linked attachments for indy format from a proposal message. This allows attachments
   * to be copied across to old style credential records
   *
   * @param options ProposeCredentialOptions object containing (optionally) the linked attachments
   * @return array of linked attachments or undefined if none present
   */
  private getCredentialLinkedAttachments(
    attributes?: CredentialPreviewAttributeOptions[],
    linkedAttachments?: LinkedAttachment[]
  ): {
    attachments?: Attachment[]
    previewAttributes?: CredentialPreviewAttribute[]
  } {
    if (!linkedAttachments && !attributes) {
      return {}
    }

    let previewAttributes = attributes?.map((attribute) => new CredentialPreviewAttribute(attribute)) ?? []
    let attachments: Attachment[] | undefined

    if (linkedAttachments) {
      // there are linked attachments so transform into the attribute field of the CredentialPreview object for
      // this proposal
      previewAttributes = IndyCredentialUtils.createAndLinkAttachmentsToPreview(linkedAttachments, previewAttributes)
      attachments = linkedAttachments.map((linkedAttachment) => linkedAttachment.attachment)
    }

    return { attachments, previewAttributes }
  }
}
