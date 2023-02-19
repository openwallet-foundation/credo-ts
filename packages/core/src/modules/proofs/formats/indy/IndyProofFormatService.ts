import type {
  IndyCredentialsForProofRequest,
  IndyGetCredentialsForProofRequestOptions,
  IndyProofFormat,
  IndySelectedCredentialsForProofRequest,
} from './IndyProofFormat'
import type { ProofAttributeInfo, ProofPredicateInfo } from './models'
import type { AgentContext } from '../../../../agent'
import type { ProofFormatService } from '../ProofFormatService'
import type {
  ProofFormatCreateProposalOptions,
  ProofFormatCreateReturn,
  ProofFormatAcceptProposalOptions,
  ProofFormatAcceptRequestOptions,
  ProofFormatAutoRespondProposalOptions,
  ProofFormatAutoRespondRequestOptions,
  ProofFormatGetCredentialsForRequestOptions,
  ProofFormatGetCredentialsForRequestReturn,
  ProofFormatSelectCredentialsForRequestOptions,
  ProofFormatSelectCredentialsForRequestReturn,
  ProofFormatProcessOptions,
  FormatCreateRequestOptions,
  ProofFormatProcessPresentationOptions,
} from '../ProofFormatServiceOptions'
import type { CredDef, IndyProof, IndyProofRequest, Schema } from 'indy-sdk'

import { Attachment, AttachmentData } from '../../../../decorators/attachment/Attachment'
import { AriesFrameworkError } from '../../../../error/AriesFrameworkError'
import { JsonEncoder } from '../../../../utils/JsonEncoder'
import { JsonTransformer } from '../../../../utils/JsonTransformer'
import { MessageValidator } from '../../../../utils/MessageValidator'
import { IndyCredential, IndyCredentialInfo } from '../../../credentials'
import { IndyCredentialUtils } from '../../../credentials/formats/indy/IndyCredentialUtils'
import { IndyVerifierService, IndyHolderService, IndyRevocationService } from '../../../indy'
import { IndyLedgerService } from '../../../ledger'
import { ProofFormatSpec } from '../../models/ProofFormatSpec'

import { InvalidEncodedValueError } from './errors/InvalidEncodedValueError'
import { RequestedAttribute, RequestedPredicate } from './models'
import { PartialProof } from './models/PartialProof'
import { ProofRequest } from './models/ProofRequest'
import { RequestedCredentials } from './models/RequestedCredentials'
import { areIndyProofRequestsEqual, assertNoDuplicateGroupsNamesInProofRequest, createRequestFromPreview } from './util'
import { sortRequestedCredentials } from './util/sortRequestedCredentials'

const V2_INDY_PRESENTATION_PROPOSAL = 'hlindy/proof-req@v2.0'
const V2_INDY_PRESENTATION_REQUEST = 'hlindy/proof-req@v2.0'
const V2_INDY_PRESENTATION = 'hlindy/proof@v2.0'

export class IndyProofFormatService implements ProofFormatService<IndyProofFormat> {
  public readonly formatKey = 'indy' as const

  public async createProposal(
    agentContext: AgentContext,
    { attachmentId, proofFormats }: ProofFormatCreateProposalOptions<IndyProofFormat>
  ): Promise<ProofFormatCreateReturn> {
    const format = new ProofFormatSpec({
      format: V2_INDY_PRESENTATION_PROPOSAL,
      attachmentId,
    })

    const indyFormat = proofFormats.indy
    if (!indyFormat) {
      throw Error('Missing indy format to create proposal attachment format')
    }

    const proofRequest = createRequestFromPreview({
      attributes: indyFormat.attributes ?? [],
      predicates: indyFormat.predicates ?? [],
      name: indyFormat.name ?? 'Proof request',
      version: indyFormat.version ?? '1.0',
      nonce: await agentContext.wallet.generateNonce(),
    })
    const attachment = this.getFormatData(proofRequest.toJSON(), format.attachmentId)

    return { attachment, format }
  }

  public async processProposal(agentContext: AgentContext, { attachment }: ProofFormatProcessOptions): Promise<void> {
    const proposalJson = attachment.getDataAsJson()

    // fromJSON also validates
    const proposal = JsonTransformer.fromJSON(proposalJson, ProofRequest)

    // Assert attribute and predicate (group) names do not match
    assertNoDuplicateGroupsNamesInProofRequest(proposal)
  }

  public async acceptProposal(
    agentContext: AgentContext,
    { proposalAttachment, attachmentId }: ProofFormatAcceptProposalOptions<IndyProofFormat>
  ): Promise<ProofFormatCreateReturn> {
    const format = new ProofFormatSpec({
      format: V2_INDY_PRESENTATION_REQUEST,
      attachmentId,
    })

    const proposalJson = proposalAttachment.getDataAsJson()

    // The proposal and request formats are the same, so we can just use the proposal
    const request = JsonTransformer.fromJSON(proposalJson, ProofRequest)

    // We never want to reuse the nonce from the proposal, as this will allow replay attacks
    request.nonce = await agentContext.wallet.generateNonce()

    const attachment = this.getFormatData(request.toJSON(), format.attachmentId)

    return { attachment, format }
  }

  public async createRequest(
    agentContext: AgentContext,
    { attachmentId, proofFormats }: FormatCreateRequestOptions<IndyProofFormat>
  ): Promise<ProofFormatCreateReturn> {
    const format = new ProofFormatSpec({
      format: V2_INDY_PRESENTATION_REQUEST,
      attachmentId,
    })

    const indyFormat = proofFormats.indy
    if (!indyFormat) {
      throw Error('Missing indy format in create request attachment format')
    }

    const request = new ProofRequest({
      name: indyFormat.name,
      version: indyFormat.version,
      nonce: await agentContext.wallet.generateNonce(),
      requestedAttributes: indyFormat.requestedAttributes,
      requestedPredicates: indyFormat.requestedPredicates,
      nonRevoked: indyFormat.nonRevoked,
    })

    // Validate to make sure user provided correct input
    MessageValidator.validateSync(request)
    assertNoDuplicateGroupsNamesInProofRequest(request)

    const attachment = this.getFormatData(request.toJSON(), format.attachmentId)

    return { attachment, format }
  }

  public async processRequest(agentContext: AgentContext, { attachment }: ProofFormatProcessOptions): Promise<void> {
    const requestJson = attachment.getDataAsJson()

    // fromJSON also validates
    const proofRequest = JsonTransformer.fromJSON(requestJson, ProofRequest)

    // Assert attribute and predicate (group) names do not match
    assertNoDuplicateGroupsNamesInProofRequest(proofRequest)
  }

  public async acceptRequest(
    agentContext: AgentContext,
    { proofFormats, requestAttachment, attachmentId }: ProofFormatAcceptRequestOptions<IndyProofFormat>
  ): Promise<ProofFormatCreateReturn> {
    const format = new ProofFormatSpec({
      format: V2_INDY_PRESENTATION,
      attachmentId,
    })

    const indyFormat = proofFormats?.indy

    const requestJson = requestAttachment.getDataAsJson()
    const proofRequest = JsonTransformer.fromJSON(requestJson, ProofRequest)

    let requestedCredentials: RequestedCredentials

    if (indyFormat) {
      requestedCredentials = new RequestedCredentials({
        requestedAttributes: indyFormat.requestedAttributes,
        requestedPredicates: indyFormat.requestedPredicates,
        selfAttestedAttributes: indyFormat.selfAttestedAttributes,
      })

      // Validate to make sure user provided correct input
      MessageValidator.validateSync(requestedCredentials)
    } else {
      const selectedCredentials = await this._selectCredentialsForRequest(agentContext, proofRequest, {
        filterByNonRevocationRequirements: true,
      })

      requestedCredentials = new RequestedCredentials({
        requestedAttributes: selectedCredentials.requestedAttributes,
        requestedPredicates: selectedCredentials.requestedPredicates,
        selfAttestedAttributes: selectedCredentials.selfAttestedAttributes,
      })
    }

    const proof = await this.createProof(agentContext, proofRequest, requestedCredentials)
    const attachment = this.getFormatData(proof, format.attachmentId)

    return {
      attachment,
      format,
    }
  }

  public async processPresentation(
    agentContext: AgentContext,
    { requestAttachment, attachment }: ProofFormatProcessPresentationOptions
  ): Promise<boolean> {
    const indyVerifierService = agentContext.dependencyManager.resolve(IndyVerifierService)

    const proofRequestJson = requestAttachment.getDataAsJson()
    const proofRequest = JsonTransformer.fromJSON(proofRequestJson, ProofRequest)

    const proofJson = attachment.getDataAsJson<IndyProof>()
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

    const schemas = await this.getSchemas(agentContext, new Set(proof.identifiers.map((i) => i.schemaId)))
    const credentialDefinitions = await this.getCredentialDefinitions(
      agentContext,
      new Set(proof.identifiers.map((i) => i.credentialDefinitionId))
    )

    return await indyVerifierService.verifyProof(agentContext, {
      proofRequest: proofRequest.toJSON(),
      proof: proofJson,
      schemas,
      credentialDefinitions,
    })
  }

  public async getCredentialsForRequest(
    agentContext: AgentContext,
    { requestAttachment, proofFormats }: ProofFormatGetCredentialsForRequestOptions<IndyProofFormat>
  ): Promise<ProofFormatGetCredentialsForRequestReturn<IndyProofFormat>> {
    const proofRequestJson = requestAttachment.getDataAsJson()
    const proofRequest = JsonTransformer.fromJSON(proofRequestJson, ProofRequest)

    // Set default values
    const { filterByNonRevocationRequirements = true } = proofFormats?.indy ?? {}

    const credentialsForRequest = await this._getCredentialsForRequest(agentContext, proofRequest, {
      filterByNonRevocationRequirements,
    })

    return credentialsForRequest
  }

  public async selectCredentialsForRequest(
    agentContext: AgentContext,
    { requestAttachment, proofFormats }: ProofFormatSelectCredentialsForRequestOptions<IndyProofFormat>
  ): Promise<ProofFormatSelectCredentialsForRequestReturn<IndyProofFormat>> {
    const proofRequestJson = requestAttachment.getDataAsJson()
    const proofRequest = JsonTransformer.fromJSON(proofRequestJson, ProofRequest)

    // Set default values
    const { filterByNonRevocationRequirements = true } = proofFormats?.indy ?? {}

    const selectedCredentials = this._selectCredentialsForRequest(agentContext, proofRequest, {
      filterByNonRevocationRequirements,
    })

    return selectedCredentials
  }

  public async shouldAutoRespondToProposal(
    agentContext: AgentContext,
    { proposalAttachment, requestAttachment }: ProofFormatAutoRespondProposalOptions
  ): Promise<boolean> {
    const proposalJson = proposalAttachment.getDataAsJson<IndyProofRequest>()
    const requestJson = requestAttachment.getDataAsJson<IndyProofRequest>()

    const areRequestsEqual = areIndyProofRequestsEqual(proposalJson, requestJson)
    agentContext.config.logger.debug(`Indy request and proposal are are equal: ${areRequestsEqual}`, {
      proposalJson,
      requestJson,
    })

    return areRequestsEqual
  }

  public async shouldAutoRespondToRequest(
    agentContext: AgentContext,
    { proposalAttachment, requestAttachment }: ProofFormatAutoRespondRequestOptions
  ): Promise<boolean> {
    const proposalJson = proposalAttachment.getDataAsJson<IndyProofRequest>()
    const requestJson = requestAttachment.getDataAsJson<IndyProofRequest>()

    return areIndyProofRequestsEqual(proposalJson, requestJson)
  }

  public async shouldAutoRespondToPresentation(): Promise<boolean> {
    // The presentation is already verified in processPresentation, so we can just return true here.
    // It's only an ack, so it's just that we received the presentation.
    return true
  }

  public supportsFormat(formatIdentifier: string): boolean {
    const supportedFormats = [V2_INDY_PRESENTATION_PROPOSAL, V2_INDY_PRESENTATION_REQUEST, V2_INDY_PRESENTATION]
    return supportedFormats.includes(formatIdentifier)
  }

  private async _getCredentialsForRequest(
    agentContext: AgentContext,
    proofRequest: ProofRequest,
    options: IndyGetCredentialsForProofRequestOptions
  ): Promise<IndyCredentialsForProofRequest> {
    const credentialsForProofRequest: IndyCredentialsForProofRequest = {
      attributes: {},
      predicates: {},
    }

    const proofRequestJson = proofRequest.toJSON()

    for (const [referent, requestedAttribute] of proofRequest.requestedAttributes.entries()) {
      const credentials = await this.getCredentialsForProofRequestReferent(agentContext, proofRequestJson, referent)

      credentialsForProofRequest.attributes[referent] = sortRequestedCredentials(
        await Promise.all(
          credentials.map(async (credential: IndyCredential) => {
            const { revoked, deltaTimestamp } = await this.getRevocationStatusForRequestedItem(agentContext, {
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
      )

      // We only attach revoked state if non-revocation is requested. So if revoked is true it means
      // the credential is not applicable to the proof request
      if (options.filterByNonRevocationRequirements) {
        credentialsForProofRequest.attributes[referent] = credentialsForProofRequest.attributes[referent].filter(
          (r) => !r.revoked
        )
      }
    }

    for (const [referent, requestedPredicate] of proofRequest.requestedPredicates.entries()) {
      const credentials = await this.getCredentialsForProofRequestReferent(agentContext, proofRequestJson, referent)

      credentialsForProofRequest.predicates[referent] = sortRequestedCredentials(
        await Promise.all(
          credentials.map(async (credential) => {
            const { revoked, deltaTimestamp } = await this.getRevocationStatusForRequestedItem(agentContext, {
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
      )

      // We only attach revoked state if non-revocation is requested. So if revoked is true it means
      // the credential is not applicable to the proof request
      if (options.filterByNonRevocationRequirements) {
        credentialsForProofRequest.predicates[referent] = credentialsForProofRequest.predicates[referent].filter(
          (r) => !r.revoked
        )
      }
    }

    return credentialsForProofRequest
  }

  private async _selectCredentialsForRequest(
    agentContext: AgentContext,
    proofRequest: ProofRequest,
    options: IndyGetCredentialsForProofRequestOptions
  ): Promise<IndySelectedCredentialsForProofRequest> {
    const credentialsForRequest = await this._getCredentialsForRequest(agentContext, proofRequest, options)

    const selectedCredentials: IndySelectedCredentialsForProofRequest = {
      requestedAttributes: {},
      requestedPredicates: {},
      selfAttestedAttributes: {},
    }

    Object.keys(credentialsForRequest.attributes).forEach((attributeName) => {
      const attributeArray = credentialsForRequest.attributes[attributeName]

      if (attributeArray.length === 0) {
        throw new AriesFrameworkError('Unable to automatically select requested attributes.')
      }

      selectedCredentials.requestedAttributes[attributeName] = attributeArray[0]
    })

    Object.keys(credentialsForRequest.predicates).forEach((attributeName) => {
      if (credentialsForRequest.predicates[attributeName].length === 0) {
        throw new AriesFrameworkError('Unable to automatically select requested predicates.')
      } else {
        selectedCredentials.requestedPredicates[attributeName] = credentialsForRequest.predicates[attributeName][0]
      }
    })

    return selectedCredentials
  }

  private async getCredentialsForProofRequestReferent(
    agentContext: AgentContext,
    // pass as json to prevent having to transform to json on every call
    proofRequestJson: IndyProofRequest,
    attributeReferent: string
  ): Promise<IndyCredential[]> {
    const holderService = agentContext.dependencyManager.resolve(IndyHolderService)

    const credentialsJson = await holderService.getCredentialsForProofRequest(agentContext, {
      proofRequest: proofRequestJson,
      attributeReferent,
    })

    return JsonTransformer.fromJSON(credentialsJson, IndyCredential) as unknown as IndyCredential[]
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
  private async getSchemas(agentContext: AgentContext, schemaIds: Set<string>) {
    const ledgerService = agentContext.dependencyManager.resolve(IndyLedgerService)

    const schemas: { [key: string]: Schema } = {}

    for (const schemaId of schemaIds) {
      const schema = await ledgerService.getSchema(agentContext, schemaId)
      schemas[schemaId] = schema
    }

    return schemas
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
  private async getCredentialDefinitions(agentContext: AgentContext, credentialDefinitionIds: Set<string>) {
    const ledgerService = agentContext.dependencyManager.resolve(IndyLedgerService)

    const credentialDefinitions: { [key: string]: CredDef } = {}

    for (const credDefId of credentialDefinitionIds) {
      const credDef = await ledgerService.getCredentialDefinition(agentContext, credDefId)
      credentialDefinitions[credDefId] = credDef
    }

    return credentialDefinitions
  }

  /**
   * Create indy proof from a given proof request and requested credential object.
   *
   * @param proofRequest The proof request to create the proof for
   * @param requestedCredentials The requested credentials object specifying which credentials to use for the proof
   * @returns indy proof object
   */
  private async createProof(
    agentContext: AgentContext,
    proofRequest: ProofRequest,
    requestedCredentials: RequestedCredentials
  ): Promise<IndyProof> {
    const indyHolderService = agentContext.dependencyManager.resolve(IndyHolderService)

    const credentialObjects = await Promise.all(
      [
        ...Object.values(requestedCredentials.requestedAttributes),
        ...Object.values(requestedCredentials.requestedPredicates),
      ].map(async (c) => {
        if (c.credentialInfo) {
          return c.credentialInfo
        }
        const credentialInfo = await indyHolderService.getCredential(agentContext, c.credentialId)
        return JsonTransformer.fromJSON(credentialInfo, IndyCredentialInfo)
      })
    )

    const schemas = await this.getSchemas(agentContext, new Set(credentialObjects.map((c) => c.schemaId)))
    const credentialDefinitions = await this.getCredentialDefinitions(
      agentContext,
      new Set(credentialObjects.map((c) => c.credentialDefinitionId))
    )

    return await indyHolderService.createProof(agentContext, {
      proofRequest: proofRequest.toJSON(),
      requestedCredentials: requestedCredentials,
      schemas,
      credentialDefinitions,
    })
  }

  private async getRevocationStatusForRequestedItem(
    agentContext: AgentContext,
    {
      proofRequest,
      requestedItem,
      credential,
    }: {
      proofRequest: ProofRequest
      requestedItem: ProofAttributeInfo | ProofPredicateInfo
      credential: IndyCredential
    }
  ) {
    const indyRevocationService = agentContext.dependencyManager.resolve(IndyRevocationService)

    const requestNonRevoked = requestedItem.nonRevoked ?? proofRequest.nonRevoked
    const credentialRevocationId = credential.credentialInfo.credentialRevocationId
    const revocationRegistryId = credential.credentialInfo.revocationRegistryId

    // If revocation interval is present and the credential is revocable then fetch the revocation status of credentials for display
    if (requestNonRevoked && credentialRevocationId && revocationRegistryId) {
      agentContext.config.logger.trace(
        `Presentation is requesting proof of non revocation, getting revocation status for credential`,
        {
          requestNonRevoked,
          credentialRevocationId,
          revocationRegistryId,
        }
      )

      // Note presentation from-to's vs ledger from-to's: https://github.com/hyperledger/indy-hipe/blob/master/text/0011-cred-revocation/README.md#indy-node-revocation-registry-intervals
      const status = await indyRevocationService.getRevocationStatus(
        agentContext,
        credentialRevocationId,
        revocationRegistryId,
        requestNonRevoked
      )

      return status
    }

    return { revoked: undefined, deltaTimestamp: undefined }
  }

  /**
   * Returns an object of type {@link Attachment} for use in credential exchange messages.
   * It looks up the correct format identifier and encodes the data as a base64 attachment.
   *
   * @param data The data to include in the attach object
   * @param id the attach id from the formats component of the message
   */
  private getFormatData(data: unknown, id: string): Attachment {
    const attachment = new Attachment({
      id,
      mimeType: 'application/json',
      data: new AttachmentData({
        base64: JsonEncoder.toBase64(data),
      }),
    })

    return attachment
  }
}
