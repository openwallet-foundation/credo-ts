import type { IndyHolderService, IndyVerifierService } from '../../../indy'
import type { IndyLedgerService } from '../../../ledger'
import type { ProofAttachmentFormat } from '../models/ProofAttachmentFormat'
import type {
  CreatePresentationOptions,
  CreateProposalOptions,
  CreateRequestAttachmentOptions,
  CreateRequestOptions,
  ProcessPresentationOptions,
  ProcessProposalOptions,
  ProcessRequestOptions,
  VerifyProofOptions,
} from '../models/ProofFormatServiceOptions'
import type { CredDef, IndyProof, Schema } from 'indy-sdk'

import { Attachment, AttachmentData } from '../../../../decorators/attachment/Attachment'
import { AriesFrameworkError } from '../../../../error/AriesFrameworkError'
import { JsonEncoder } from '../../../../utils/JsonEncoder'
import { JsonTransformer } from '../../../../utils/JsonTransformer'
import { CredentialRepository, CredentialUtils } from '../../../credentials'
import { V1PresentationProblemReportError } from '../../protocol/v1/errors/V1PresentationProblemReportError'
import { V1PresentationProblemReportReason } from '../../protocol/v1/errors/V1PresentationProblemReportReason'
import { PartialProof, ProofRequest, RequestedCredentials } from '../../protocol/v1/models'
import { ProofFormatService } from '../ProofFormatService'
import { ProofFormatSpec } from '../models/ProofFormatSpec'
import { MissingIndyProofMessageError } from '../errors/MissingIndyProofMessageError'
import { InvalidEncodedValueError } from '../errors/InvalidEncodedValueError'
import { Lifecycle, scoped } from 'tsyringe'

@scoped(Lifecycle.ContainerScoped)
export class IndyProofFormatService extends ProofFormatService {
  private indyHolderService: IndyHolderService
  private indyVerifierService: IndyVerifierService
  private ledgerService: IndyLedgerService

  public constructor(
    indyHolderService: IndyHolderService,
    indyVerifierService: IndyVerifierService,
    ledgerService: IndyLedgerService
  ) {
    super()
    this.indyHolderService = indyHolderService
    this.indyVerifierService = indyVerifierService
    this.ledgerService = ledgerService
  }

  private createRequestAttachment(options: CreateRequestAttachmentOptions): ProofAttachmentFormat {
    const format = new ProofFormatSpec({
      attachmentId: options.attachId,
      format: 'hlindy/proof-req@v2.0',
    })

    const request = new ProofRequest(options.proofRequestOptions)

    const attachment = new Attachment({
      id: options.attachId,
      mimeType: 'application/json',
      data: new AttachmentData({
        base64: JsonEncoder.toBase64(request),
      }),
    })
    return { format, attachment }
  }

  public createProposal(options: CreateProposalOptions): ProofAttachmentFormat {
    if (!options.formats.indy) {
      throw Error('Indy format missing')
    }

    return this.createRequestAttachment({
      attachId: options.attachId,
      proofRequestOptions: options.formats.indy,
    })
  }

  public processProposal(options: ProcessProposalOptions): void {
    throw new Error('Method not implemented.')
  }

  public createRequest(options: CreateRequestOptions): ProofAttachmentFormat {
    if (!options.formats.indy) {
      throw new AriesFrameworkError(
        'Unable to get requested credentials for proof request. No proof request message was found or the proof request message does not contain an indy proof request.'
      )
    }

    return this.createRequestAttachment({
      attachId: options.attachId,
      proofRequestOptions: options.formats.indy,
    })
  }

  public processRequest(options: ProcessRequestOptions): void {
    throw new Error('Method not implemented.')
  }

  public async createPresentation(options: CreatePresentationOptions): Promise<ProofAttachmentFormat> {
    // Extract proof request from attachment
    const proofRequestJson = options.attachment.getDataAsJson<ProofRequest>() ?? null
    const proofRequest = JsonTransformer.fromJSON(proofRequestJson, ProofRequest)

    // verify everything is there
    if (!options.formats.indy) {
      throw new AriesFrameworkError('No attributes received for requested credentials.')
    }

    const requestedCredentials = new RequestedCredentials({
      requestedAttributes: options.formats.indy.requestedAttributes,
      requestedPredicates: options.formats.indy.requestedPredicates,
      selfAttestedAttributes: options.formats.indy.selfAttestedAttributes,
    })

    const proof = await this.createProof(proofRequest, requestedCredentials)

    const format = new ProofFormatSpec({
      attachmentId: options.attachId,
      format: 'hlindy/proof@v2.0',
    })

    const attachment = new Attachment({
      id: options.attachId,
      mimeType: 'application/json',
      data: new AttachmentData({
        base64: JsonEncoder.toBase64(proof),
      }),
    })
    return { format, attachment }
  }

  public async processPresentation(options: ProcessPresentationOptions): Promise<boolean> {
    const requestFormat = options.presentation.request.find((x) => x.format.attachmentId === 'hlindy/proof-req@v2.0')

    const proofFormat = options.presentation.proof.find((x) => x.format.attachmentId === 'hlindy/proof@v2.0')

    if (!proofFormat) {
      throw new MissingIndyProofMessageError(
        'Missing Indy Proof Presentation format while trying to process an Indy proof presentation.'
      )
    }

    if (!requestFormat) {
      throw new MissingIndyProofMessageError(
        'Missing Indy Proof Request format while trying to process an Indy proof presentation.'
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
      if (!CredentialUtils.checkValidEncoding(attribute.raw, attribute.encoded)) {
        throw new InvalidEncodedValueError(
          `The encoded value for '${referent}' is invalid. ` +
            `Expected '${CredentialUtils.encode(attribute.raw)}'. ` +
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
    const supportedFormats = ['hlindy/proof-req@v2.0', 'hlindy/proof@v2.0']
    return supportedFormats.includes(formatIdentifier)
  }

  // K-TODO compare presentation attrs with request/proposal attrs (auto-accept)
  public proposalAndRequestAreEqual(
    proposalAttachments: ProofAttachmentFormat[],
    requestAttachments: ProofAttachmentFormat[]
  ) {
    const proposalAttachment = proposalAttachments.find((x) => x.format.format === 'hlindy/proof-req@2.0')?.attachment
    const requestAttachment = requestAttachments.find((x) => x.format.format === 'hlindy/proof-req@2.0')?.attachment

    if (!proposalAttachment) {
      throw new AriesFrameworkError('Proposal message has no attachment linked to it')
    }

    if (!requestAttachment) {
      throw new AriesFrameworkError('Request message has no attachment linked to it')
    }

    const proposalAttachmentData = proposalAttachment.getDataAsJson<ProofRequest>()
    const requestAttachmentData = requestAttachment.getDataAsJson<ProofRequest>()

    if (
      proposalAttachmentData.requestedAttributes === requestAttachmentData.requestedAttributes &&
      proposalAttachmentData.requestedPredicates === requestAttachmentData.requestedPredicates
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
    const credentialObjects = [
      ...Object.values(requestedCredentials.requestedAttributes),
      ...Object.values(requestedCredentials.requestedPredicates),
    ].map((c) => c.credentialInfo)

    const schemas = await this.getSchemas(new Set(credentialObjects.map((c) => c.schemaId)))
    const credentialDefinitions = await this.getCredentialDefinitions(
      new Set(credentialObjects.map((c) => c.credentialDefinitionId))
    )

    const proof = await this.indyHolderService.createProof({
      proofRequest: proofRequest.toJSON(),
      requestedCredentials: requestedCredentials.toJSON(),
      schemas,
      credentialDefinitions,
    })

    return proof
  }
}
