import type { Logger } from '../../../../logger'
import type {
  RetrievedCredentialOptions,
  ProofRequestFormats,
  RequestedCredentialsFormats,
} from '../../models/SharedOptions'
import type { CreateRequestAsResponseOptions, GetRequestedCredentialsFormat } from '../IndyProofFormatsServiceOptions'
import type { ProofAttachmentFormat } from '../models/ProofAttachmentFormat'
import type {
  CreatePresentationFormatsOptions,
  CreatePresentationOptions,
  CreateProofAttachmentOptions,
  CreateProposalOptions,
  CreateRequestAttachmentOptions,
  CreateRequestOptions,
  ProcessPresentationOptions,
  ProcessProposalOptions,
  ProcessRequestOptions,
  VerifyProofOptions,
} from '../models/ProofFormatServiceOptions'
import type { ProofAttributeInfo, ProofPredicateInfo } from './models'
import type { CredDef, IndyProof, Schema } from 'indy-sdk'

import { Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from '../../../../agent/AgentConfig'
import { Attachment, AttachmentData } from '../../../../decorators/attachment/Attachment'
import { AriesFrameworkError } from '../../../../error/AriesFrameworkError'
import { ConsoleLogger, LogLevel } from '../../../../logger'
import { DidCommMessageRepository } from '../../../../storage/didcomm/DidCommMessageRepository'
import { checkProofRequestForDuplicates } from '../../../../utils'
import { JsonEncoder } from '../../../../utils/JsonEncoder'
import { JsonTransformer } from '../../../../utils/JsonTransformer'
import { MessageValidator } from '../../../../utils/MessageValidator'
import { ObjectCheck } from '../../../../utils/objectCheck'
import { uuid } from '../../../../utils/uuid'
import { IndyWallet } from '../../../../wallet/IndyWallet'
import { IndyCredential, IndyCredentialInfo, IndyCredentialUtils } from '../../../credentials'
import { IndyHolderService, IndyVerifierService, IndyRevocationService } from '../../../indy'
import { IndyLedgerService } from '../../../ledger'
import { PartialProof } from '../../protocol/v1/models'
import { ProofFormatService } from '../ProofFormatService'
import { V2_INDY_PRESENTATION, V2_INDY_PRESENTATION_PROPOSAL, V2_INDY_PRESENTATION_REQUEST } from '../ProofFormats'
import { InvalidEncodedValueError } from '../errors/InvalidEncodedValueError'
import { MissingIndyProofMessageError } from '../errors/MissingIndyProofMessageError'
import { ProofFormatSpec } from '../models/ProofFormatSpec'

import { RequestedAttribute, RequestedPredicate } from './models'
import { ProofRequest } from './models/ProofRequest'
import { RequestedCredentials } from './models/RequestedCredentials'
import { RetrievedCredentials } from './models/RetrievedCredentials'

@scoped(Lifecycle.ContainerScoped)
export class IndyProofFormatService extends ProofFormatService {
  private indyHolderService: IndyHolderService
  private indyVerifierService: IndyVerifierService
  private indyRevocationService: IndyRevocationService
  private ledgerService: IndyLedgerService
  private logger: Logger
  private wallet: IndyWallet

  public constructor(
    agentConfig: AgentConfig,
    indyHolderService: IndyHolderService,
    indyVerifierService: IndyVerifierService,
    indyRevocationService: IndyRevocationService,
    ledgerService: IndyLedgerService,
    didCommMessageRepository: DidCommMessageRepository,
    wallet: IndyWallet
  ) {
    super(didCommMessageRepository, agentConfig)
    this.indyHolderService = indyHolderService
    this.indyVerifierService = indyVerifierService
    this.indyRevocationService = indyRevocationService
    this.ledgerService = ledgerService
    this.wallet = wallet
    this.logger = new ConsoleLogger(LogLevel.off)
  }

  private createRequestAttachment(options: CreateRequestAttachmentOptions): ProofAttachmentFormat {
    const format = new ProofFormatSpec({
      attachmentId: options.id,
      format: V2_INDY_PRESENTATION_REQUEST,
    })

    const request = new ProofRequest(options.proofRequestOptions)

    // Assert attribute and predicate (group) names do not match
    checkProofRequestForDuplicates(request)

    const attachment = new Attachment({
      id: options.id,
      mimeType: 'application/json',
      data: new AttachmentData({
        base64: JsonEncoder.toBase64(request),
      }),
    })
    return { format, attachment }
  }

  private async createProofAttachment(options: CreateProofAttachmentOptions): Promise<ProofAttachmentFormat> {
    const format = new ProofFormatSpec({
      attachmentId: options.id,
      format: V2_INDY_PRESENTATION_PROPOSAL,
    })

    const request = new ProofRequest(options.proofProposalOptions)
    await MessageValidator.validate(request)

    const attachment = new Attachment({
      id: options.id,
      mimeType: 'application/json',
      data: new AttachmentData({
        base64: JsonEncoder.toBase64(JsonTransformer.toJSON(request)),
      }),
    })
    return { format, attachment }
  }

  public async createProposal(options: CreateProposalOptions): Promise<ProofAttachmentFormat> {
    if (!options.formats.indy) {
      throw Error('Missing indy format to create proposal attachment format')
    }
    const indyFormat = options.formats.indy

    return await this.createProofAttachment({
      id: options.id ?? uuid(),
      proofProposalOptions: indyFormat,
    })
  }

  public async processProposal(options: ProcessProposalOptions): Promise<void> {
    const proofProposalJson = options.proposal.attachment.getDataAsJson<ProofRequest>()

    // Assert attachment
    if (!proofProposalJson) {
      throw new AriesFrameworkError(
        `Missing required base64 or json encoded attachment data for presentation proposal with thread id ${options.record?.threadId}`
      )
    }

    const proposalMessage = JsonTransformer.fromJSON(proofProposalJson, ProofRequest)

    await MessageValidator.validate(proposalMessage)
  }

  public async createRequestAsResponse(options: CreateRequestAsResponseOptions): Promise<ProofAttachmentFormat> {
    if (!options.formats.indy) {
      throw Error('Missing indy format to create proposal attachment format')
    }

    const id = options.id ?? uuid()

    const format = new ProofFormatSpec({
      attachmentId: id,
      format: V2_INDY_PRESENTATION_REQUEST,
    })

    const attachment = new Attachment({
      id: id,
      mimeType: 'application/json',
      data: new AttachmentData({
        base64: JsonEncoder.toBase64(options.formats.indy),
      }),
    })
    return { format, attachment }
  }

  public async createRequest(options: CreateRequestOptions): Promise<ProofAttachmentFormat> {
    if (!options.formats.indy) {
      throw new AriesFrameworkError('Missing indy format to create proof request attachment format.')
    }

    return this.createRequestAttachment({
      id: options.id ?? uuid(),
      proofRequestOptions: options.formats.indy,
    })
  }

  public async processRequest(options: ProcessRequestOptions): Promise<void> {
    const proofRequestJson = options.requestAttachment.attachment.getDataAsJson<ProofRequest>()

    const proofRequest = JsonTransformer.fromJSON(proofRequestJson, ProofRequest)

    // Assert attachment
    if (!proofRequest) {
      throw new AriesFrameworkError(
        `Missing required base64 or json encoded attachment data for presentation request with thread id ${options.record?.threadId}`
      )
    }
    await MessageValidator.validate(proofRequest)

    // Assert attribute and predicate (group) names do not match
    checkProofRequestForDuplicates(proofRequest)
  }

  public async createPresentation(options: CreatePresentationOptions): Promise<ProofAttachmentFormat> {
    // Extract proof request from attachment
    const proofRequestJson = options.attachment.getDataAsJson<ProofRequest>() ?? null
    const proofRequest = JsonTransformer.fromJSON(proofRequestJson, ProofRequest)

    // verify everything is there
    if (!options.formats.indy) {
      throw new AriesFrameworkError('Missing indy format to create proof presentation attachment format.')
    }

    const requestedCredentials = new RequestedCredentials({
      requestedAttributes: options.formats.indy.requestedAttributes,
      requestedPredicates: options.formats.indy.requestedPredicates,
      selfAttestedAttributes: options.formats.indy.selfAttestedAttributes,
    })

    const proof = await this.createProof(proofRequest, requestedCredentials)

    const attachmentId = options.id ?? uuid()

    const format = new ProofFormatSpec({
      attachmentId,
      format: V2_INDY_PRESENTATION,
    })

    const attachment = new Attachment({
      id: attachmentId,
      mimeType: 'application/json',
      data: new AttachmentData({
        base64: JsonEncoder.toBase64(proof),
      }),
    })
    return { format, attachment }
  }

  public async processPresentation(options: ProcessPresentationOptions): Promise<boolean> {
    const requestFormat = options.formatAttachments.request.find(
      (x) => x.format.format === V2_INDY_PRESENTATION_REQUEST
    )

    if (!requestFormat) {
      throw new MissingIndyProofMessageError(
        'Missing Indy Proof Request format while trying to process an Indy proof presentation.'
      )
    }

    const proofFormat = options.formatAttachments.presentation.find((x) => x.format.format === V2_INDY_PRESENTATION)

    if (!proofFormat) {
      throw new MissingIndyProofMessageError(
        'Missing Indy Proof Presentation format while trying to process an Indy proof presentation.'
      )
    }

    return await this.verifyProof({ request: requestFormat.attachment, proof: proofFormat.attachment })
  }

  public async verifyProof(options: VerifyProofOptions): Promise<boolean> {
    if (!options) {
      throw new AriesFrameworkError('No Indy proof was provided.')
    }
    const proofRequestJson = options.request.getDataAsJson<ProofRequest>() ?? null
    const proofRequest = JsonTransformer.fromJSON(proofRequestJson, ProofRequest)

    const proofJson = options.proof.getDataAsJson<IndyProof>() ?? null

    const proof = JsonTransformer.fromJSON(proofJson, PartialProof)

    for (const [referent, attribute] of proof.requestedProof.revealedAttributes.entries()) {
      if (!IndyCredentialUtils.checkValidEncoding(attribute.raw, attribute.encoded)) {
        throw new InvalidEncodedValueError(
          `The encoded value for '${referent}' is invalid. ` +
            `Expected '${IndyCredentialUtils.encode(attribute.raw)}'. ` +
            `Actual '${attribute.encoded}'`
        )
      }
    }

    // TODO: pre verify proof json
    // I'm not 100% sure how much indy does. Also if it checks whether the proof requests matches the proof
    // @see https://github.com/hyperledger/aries-cloudagent-python/blob/master/aries_cloudagent/indy/sdk/verifier.py#L79-L164

    const schemas = await this.getSchemas(new Set(proof.identifiers.map((i) => i.schemaId)))
    const credentialDefinitions = await this.getCredentialDefinitions(
      new Set(proof.identifiers.map((i) => i.credentialDefinitionId))
    )

    return await this.indyVerifierService.verifyProof({
      proofRequest: proofRequest.toJSON(),
      proof: proofJson,
      schemas,
      credentialDefinitions,
    })
  }

  public supportsFormat(formatIdentifier: string): boolean {
    const supportedFormats = [V2_INDY_PRESENTATION_PROPOSAL, V2_INDY_PRESENTATION_REQUEST, V2_INDY_PRESENTATION]
    return supportedFormats.includes(formatIdentifier)
  }

  /**
   * Compare presentation attrs with request/proposal attrs (auto-accept)
   *
   * @param proposalAttachments attachment data from the proposal
   * @param requestAttachments  attachment data from the request
   * @returns boolean value
   */
  public proposalAndRequestAreEqual(
    proposalAttachments: ProofAttachmentFormat[],
    requestAttachments: ProofAttachmentFormat[]
  ) {
    const proposalAttachment = proposalAttachments.find(
      (x) => x.format.format === V2_INDY_PRESENTATION_PROPOSAL
    )?.attachment
    const requestAttachment = requestAttachments.find(
      (x) => x.format.format === V2_INDY_PRESENTATION_REQUEST
    )?.attachment

    if (!proposalAttachment) {
      throw new AriesFrameworkError('Proposal message has no attachment linked to it')
    }

    if (!requestAttachment) {
      throw new AriesFrameworkError('Request message has no attachment linked to it')
    }

    const proposalAttachmentJson = proposalAttachment.getDataAsJson<ProofRequest>()
    const proposalAttachmentData = JsonTransformer.fromJSON(proposalAttachmentJson, ProofRequest)

    const requestAttachmentJson = requestAttachment.getDataAsJson<ProofRequest>()
    const requestAttachmentData = JsonTransformer.fromJSON(requestAttachmentJson, ProofRequest)

    if (
      ObjectCheck.objectEquals(proposalAttachmentData.requestedAttributes, requestAttachmentData.requestedAttributes) &&
      ObjectCheck.objectEquals(proposalAttachmentData.requestedPredicates, requestAttachmentData.requestedPredicates)
    ) {
      return true
    }

    return false
  }

  /**
   * Build credential definitions object needed to create and verify proof objects.
   *
   * Creates object with `{ credentialDefinitionId: CredentialDefinition }` mapping
   *
   * @param credentialDefinitionIds List of credential definition ids
   * @returns Object containing credential definitions for specified credential definition ids
   *
   */
  private async getCredentialDefinitions(credentialDefinitionIds: Set<string>) {
    const credentialDefinitions: { [key: string]: CredDef } = {}

    for (const credDefId of credentialDefinitionIds) {
      const credDef = await this.ledgerService.getCredentialDefinition(credDefId)
      credentialDefinitions[credDefId] = credDef
    }

    return credentialDefinitions
  }

  public async getRequestedCredentialsForProofRequest(
    options: GetRequestedCredentialsFormat
  ): Promise<RetrievedCredentialOptions> {
    const retrievedCredentials = new RetrievedCredentials({})
    const { attachment, presentationProposal } = options
    const filterByNonRevocationRequirements = options.config?.filterByNonRevocationRequirements

    const proofRequestJson = attachment.getDataAsJson<ProofRequest>() ?? null
    const proofRequest = JsonTransformer.fromJSON(proofRequestJson, ProofRequest)

    for (const [referent, requestedAttribute] of proofRequest.requestedAttributes.entries()) {
      let credentialMatch: IndyCredential[] = []
      const credentials = await this.getCredentialsForProofRequest(proofRequest, referent)

      // If we have exactly one credential, or no proposal to pick preferences
      // on the credentials to use, we will use the first one
      if (credentials.length === 1 || !presentationProposal) {
        credentialMatch = credentials
      }
      // If we have a proposal we will use that to determine the credentials to use
      else {
        const names = requestedAttribute.names ?? [requestedAttribute.name]

        // Find credentials that matches all parameters from the proposal
        credentialMatch = credentials.filter((credential) => {
          const { attributes, credentialDefinitionId } = credential.credentialInfo

          // Check if credentials matches all parameters from proposal
          return names.every((name) =>
            presentationProposal.attributes.find(
              (a) =>
                a.name === name &&
                a.credentialDefinitionId === credentialDefinitionId &&
                (!a.value || a.value === attributes[name])
            )
          )
        })
      }

      retrievedCredentials.requestedAttributes[referent] = await Promise.all(
        credentialMatch.map(async (credential: IndyCredential) => {
          const { revoked, deltaTimestamp } = await this.getRevocationStatusForRequestedItem({
            proofRequest,
            requestedItem: requestedAttribute,
            credential,
          })

          return new RequestedAttribute({
            credentialId: credential.credentialInfo.referent,
            revealed: true,
            credentialInfo: credential.credentialInfo,
            timestamp: deltaTimestamp,
            revoked,
          })
        })
      )

      // We only attach revoked state if non-revocation is requested. So if revoked is true it means
      // the credential is not applicable to the proof request
      if (filterByNonRevocationRequirements) {
        retrievedCredentials.requestedAttributes[referent] = retrievedCredentials.requestedAttributes[referent].filter(
          (r) => !r.revoked
        )
      }
    }

    for (const [referent, requestedPredicate] of proofRequest.requestedPredicates.entries()) {
      const credentials = await this.getCredentialsForProofRequest(proofRequest, referent)

      retrievedCredentials.requestedPredicates[referent] = await Promise.all(
        credentials.map(async (credential) => {
          const { revoked, deltaTimestamp } = await this.getRevocationStatusForRequestedItem({
            proofRequest,
            requestedItem: requestedPredicate,
            credential,
          })

          return new RequestedPredicate({
            credentialId: credential.credentialInfo.referent,
            credentialInfo: credential.credentialInfo,
            timestamp: deltaTimestamp,
            revoked,
          })
        })
      )

      // We only attach revoked state if non-revocation is requested. So if revoked is true it means
      // the credential is not applicable to the proof request
      if (filterByNonRevocationRequirements) {
        retrievedCredentials.requestedPredicates[referent] = retrievedCredentials.requestedPredicates[referent].filter(
          (r) => !r.revoked
        )
      }
    }

    return {
      indy: retrievedCredentials,
    }
  }

  private async getCredentialsForProofRequest(
    proofRequest: ProofRequest,
    attributeReferent: string
  ): Promise<IndyCredential[]> {
    const credentialsJson = await this.indyHolderService.getCredentialsForProofRequest({
      proofRequest: proofRequest.toJSON(),
      attributeReferent,
    })

    return JsonTransformer.fromJSON(credentialsJson, IndyCredential) as unknown as IndyCredential[]
  }

  public async autoSelectCredentialsForProofRequest(
    options: RetrievedCredentialOptions
  ): Promise<RequestedCredentialsFormats> {
    const indy = options.indy

    if (!indy) {
      throw new AriesFrameworkError('No indy options provided')
    }

    const requestedCredentials = new RequestedCredentials({})

    Object.keys(indy.requestedAttributes).forEach((attributeName) => {
      const attributeArray = indy.requestedAttributes[attributeName]

      if (attributeArray.length === 0) {
        throw new AriesFrameworkError('Unable to automatically select requested attributes.')
      } else {
        requestedCredentials.requestedAttributes[attributeName] = attributeArray[0]
      }
    })

    Object.keys(indy.requestedPredicates).forEach((attributeName) => {
      if (indy.requestedPredicates[attributeName].length === 0) {
        throw new AriesFrameworkError('Unable to automatically select requested predicates.')
      } else {
        requestedCredentials.requestedPredicates[attributeName] = indy.requestedPredicates[attributeName][0]
      }
    })

    return {
      indy: requestedCredentials,
    }
  }

  /**
   * Build schemas object needed to create and verify proof objects.
   *
   * Creates object with `{ schemaId: Schema }` mapping
   *
   * @param schemaIds List of schema ids
   * @returns Object containing schemas for specified schema ids
   *
   */
  private async getSchemas(schemaIds: Set<string>) {
    const schemas: { [key: string]: Schema } = {}

    for (const schemaId of schemaIds) {
      const schema = await this.ledgerService.getSchema(schemaId)
      schemas[schemaId] = schema
    }

    return schemas
  }

  /**
   * Create indy proof from a given proof request and requested credential object.
   *
   * @param proofRequest The proof request to create the proof for
   * @param requestedCredentials The requested credentials object specifying which credentials to use for the proof
   * @returns indy proof object
   */
  private async createProof(
    proofRequest: ProofRequest,
    requestedCredentials: RequestedCredentials
  ): Promise<IndyProof> {
    const credentialObjects = await Promise.all(
      [
        ...Object.values(requestedCredentials.requestedAttributes),
        ...Object.values(requestedCredentials.requestedPredicates),
      ].map(async (c) => {
        if (c.credentialInfo) {
          return c.credentialInfo
        }
        const credentialInfo = await this.indyHolderService.getCredential(c.credentialId)
        return JsonTransformer.fromJSON(credentialInfo, IndyCredentialInfo)
      })
    )

    const schemas = await this.getSchemas(new Set(credentialObjects.map((c) => c.schemaId)))
    const credentialDefinitions = await this.getCredentialDefinitions(
      new Set(credentialObjects.map((c) => c.credentialDefinitionId))
    )

    return await this.indyHolderService.createProof({
      proofRequest: proofRequest.toJSON(),
      requestedCredentials: requestedCredentials,
      schemas,
      credentialDefinitions,
    })
  }

  public async createProofRequestFromProposal(options: CreatePresentationFormatsOptions): Promise<ProofRequestFormats> {
    const proofRequestJson = options.presentationAttachment.getDataAsJson<ProofRequest>()

    const proofRequest = JsonTransformer.fromJSON(proofRequestJson, ProofRequest)

    // Assert attachment
    if (!proofRequest) {
      throw new AriesFrameworkError(`Missing required base64 or json encoded attachment data for presentation request.`)
    }
    await MessageValidator.validate(proofRequest)

    // Assert attribute and predicate (group) names do not match
    checkProofRequestForDuplicates(proofRequest)

    return {
      indy: proofRequest,
    }
  }

  private async getRevocationStatusForRequestedItem({
    proofRequest,
    requestedItem,
    credential,
  }: {
    proofRequest: ProofRequest
    requestedItem: ProofAttributeInfo | ProofPredicateInfo
    credential: IndyCredential
  }) {
    const requestNonRevoked = requestedItem.nonRevoked ?? proofRequest.nonRevoked
    const credentialRevocationId = credential.credentialInfo.credentialRevocationId
    const revocationRegistryId = credential.credentialInfo.revocationRegistryId

    // If revocation interval is present and the credential is revocable then fetch the revocation status of credentials for display
    if (requestNonRevoked && credentialRevocationId && revocationRegistryId) {
      this.logger.trace(
        `Presentation is requesting proof of non revocation, getting revocation status for credential`,
        {
          requestNonRevoked,
          credentialRevocationId,
          revocationRegistryId,
        }
      )

      // Note presentation from-to's vs ledger from-to's: https://github.com/hyperledger/indy-hipe/blob/master/text/0011-cred-revocation/README.md#indy-node-revocation-registry-intervals
      const status = await this.indyRevocationService.getRevocationStatus(
        credentialRevocationId,
        revocationRegistryId,
        requestNonRevoked
      )

      return status
    }

    return { revoked: undefined, deltaTimestamp: undefined }
  }
}
