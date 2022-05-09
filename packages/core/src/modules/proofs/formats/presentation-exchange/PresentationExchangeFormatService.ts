import type { W3cCredential } from '../../../vc/models'
import type { SignPresentationOptions, VerifyPresentationOptions } from '../../../vc/models/W3cCredentialServiceOptions'
import type {
  AutoSelectCredentialOptions,
  ProofRequestFormats,
  RequestedCredentialsFormats,
} from '../../models/SharedOptions'
import type { GetRequestedCredentialsFormat } from '../IndyProofFormatsServiceOptions'
import type { ProofAttachmentFormat } from '../models/ProofAttachmentFormat'
import type {
  CreatePresentationFormatsOptions,
  CreatePresentationOptions,
  CreateProposalOptions,
  CreateRequestAsResponseOptions,
  CreateRequestOptions,
  ProcessPresentationOptions,
  ProcessProposalOptions,
  ProcessRequestOptions,
} from '../models/ProofFormatServiceOptions'
import type { InputDescriptorsSchemaOptions, SchemaOptions } from './models'

import { Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from '../../../../agent/AgentConfig'
import { Attachment, AttachmentData } from '../../../../decorators/attachment/Attachment'
import { AriesFrameworkError } from '../../../../error'
import { DidCommMessageRepository } from '../../../../storage/didcomm/DidCommMessageRepository'
import { JsonTransformer } from '../../../../utils'
import { uuid } from '../../../../utils/uuid'
import { DidResolverService } from '../../../dids'
import { W3cCredentialService } from '../../../vc'
import { W3cVerifiableCredential } from '../../../vc/models'
import { LinkedDataProof } from '../../../vc/models/LinkedDataProof'
import { CredentialSubject } from '../../../vc/models/credential/CredentialSubject'
import { W3cVerifiablePresentation } from '../../../vc/models/presentation/W3cVerifiablePresentation'
import { ProofFormatService } from '../ProofFormatService'
import {
  V2_PRESENTATION_EXCHANGE_PRESENTATION,
  V2_PRESENTATION_EXCHANGE_PRESENTATION_PROPOSAL,
  V2_PRESENTATION_EXCHANGE_PRESENTATION_REQUEST,
} from '../ProofFormats'
import { ProofFormatSpec } from '../models/ProofFormatSpec'

import { InputDescriptorsSchema } from './models'
import { PresentationDefinition, RequestPresentation } from './models/RequestPresentation'

@scoped(Lifecycle.ContainerScoped)
export class PresentationExchangeFormatService extends ProofFormatService {
  private w3cCredentialService: W3cCredentialService
  private didResolver: DidResolverService

  public constructor(
    agentConfig: AgentConfig,
    didCommMessageRepository: DidCommMessageRepository,
    w3cCredentialService: W3cCredentialService,
    didResolver: DidResolverService
  ) {
    super(didCommMessageRepository, agentConfig)
    this.w3cCredentialService = w3cCredentialService
    this.didResolver = didResolver
  }

  public async createProposal(options: CreateProposalOptions): Promise<ProofAttachmentFormat> {
    if (!options.formats.presentationExchange) {
      throw Error('Presentation Exchange format missing while creating proof proposal.')
    }

    if (!options.formats.presentationExchange.inputDescriptors) {
      throw Error('Input Descriptor missing while creating proof proposal.')
    }

    const inputDescriptorsSchemaOptions: InputDescriptorsSchemaOptions = {
      inputDescriptors: options.formats.presentationExchange.inputDescriptors,
    }

    const proposalInputDescriptor = new InputDescriptorsSchema(inputDescriptorsSchemaOptions)
    const attachId = options.attachId ?? uuid()

    const format = new ProofFormatSpec({
      attachmentId: attachId,
      format: V2_PRESENTATION_EXCHANGE_PRESENTATION_PROPOSAL,
    })

    const attachment = new Attachment({
      id: attachId,
      mimeType: 'application/json',
      data: new AttachmentData({
        json: proposalInputDescriptor.toJSON(),
      }),
    })

    return { format, attachment }
  }

  public processProposal(options: ProcessProposalOptions): void {
    throw new Error('Method not implemented.')
  }

  public async createProofRequestFromProposal(options: CreatePresentationFormatsOptions): Promise<ProofRequestFormats> {
    const inputDescriptorsJson = options.presentationAttachment.getDataAsJson<InputDescriptorsSchema>() ?? null

    const presentationDefinition: PresentationDefinition = new PresentationDefinition({
      inputDescriptors: inputDescriptorsJson['input_descriptors'],
      format: {
        ldpVc: {
          proofType: ['Ed25519Signature2018'],
        },
      },
    })

    const presentationExchangeRequestMessage: RequestPresentation = new RequestPresentation({
      options: {
        challenge: uuid(),
        domain: '',
      },
      presentationDefinition: presentationDefinition,
    })

    return {
      presentationExchange: presentationExchangeRequestMessage,
    }
  }

  public async createRequestAsResponse(options: CreateRequestAsResponseOptions): Promise<ProofAttachmentFormat> {
    if (!options.formats.presentationExchange) {
      throw Error('Presentation Exchange format missing while creating proof request as response.')
    }

    if (!options.formats.presentationExchange) {
      throw Error('Input Descriptor missing while creating proof request as response.')
    }

    const presentationExchangeRequestMessage: RequestPresentation = new RequestPresentation({
      options: options.formats.presentationExchange.options,
      presentationDefinition: options.formats.presentationExchange.presentationDefinition,
    })

    const attachId = options.attachId ?? uuid()

    const format = new ProofFormatSpec({
      attachmentId: attachId,
      format: V2_PRESENTATION_EXCHANGE_PRESENTATION_REQUEST,
    })

    const attachment = new Attachment({
      id: attachId,
      mimeType: 'application/json',
      data: new AttachmentData({
        json: presentationExchangeRequestMessage.toJSON(),
      }),
    })

    return { format, attachment }
  }

  public async createRequest(options: CreateRequestOptions): Promise<ProofAttachmentFormat> {
    if (!options.formats.presentationExchange) {
      throw Error('Presentation Exchange format missing')
    }

    const presentationExchangeFormat = options.formats.presentationExchange

    const requestPresentation = JsonTransformer.fromJSON(presentationExchangeFormat, RequestPresentation)

    if (!requestPresentation.presentationDefinition.inputDescriptors) {
      throw Error('Input Descriptor missing while creating the request in presentation exchange service.')
    }

    const inputDescriptorsSchemaOptions: InputDescriptorsSchemaOptions = {
      inputDescriptors: requestPresentation.presentationDefinition.inputDescriptors,
    }

    const presentationDefinition: PresentationDefinition = new PresentationDefinition({
      inputDescriptors: inputDescriptorsSchemaOptions.inputDescriptors,
      format: requestPresentation.presentationDefinition.format,
    })

    const presentationExchangeRequestMessage: RequestPresentation = new RequestPresentation({
      options: {
        challenge: requestPresentation.options.challenge ?? uuid(),
        domain: '',
      },
      presentationDefinition: presentationDefinition,
    })

    const attachId = options.attachId ?? uuid()

    const format = new ProofFormatSpec({
      attachmentId: attachId,
      format: V2_PRESENTATION_EXCHANGE_PRESENTATION_REQUEST,
    })

    const attachment = new Attachment({
      id: attachId,
      mimeType: 'application/json',
      data: new AttachmentData({
        json: presentationExchangeRequestMessage.toJSON(),
      }),
    })

    return { format, attachment }
  }

  public processRequest(options: ProcessRequestOptions): void {
    throw new Error('Method not implemented.')
  }

  public async createPresentation(options: CreatePresentationOptions): Promise<ProofAttachmentFormat> {
    if (!options.formats.presentationExchange) {
      throw Error('Presentation Exchange format missing while creating presentation in presentation exchange service.')
    }

    const requestAttachment = options.attachment.getDataAsJson<Attachment>()
    const requestPresentation = JsonTransformer.fromJSON(requestAttachment, RequestPresentation)

    const w3cVerifiableCredentials = JsonTransformer.fromJSON(
      options.formats.presentationExchange,
      W3cVerifiableCredential
    )

    const proof = JsonTransformer.fromJSON(w3cVerifiableCredentials.proof, LinkedDataProof)
    const subject = JsonTransformer.fromJSON(w3cVerifiableCredentials.credentialSubject, CredentialSubject)

    const didResolutionResult = await this.didResolver.resolve(subject.id)

    if (!didResolutionResult.didDocument) {
      throw new AriesFrameworkError(`No did document found for did ${subject.id}`)
    }

    if (!didResolutionResult.didDocument?.authentication) {
      throw new AriesFrameworkError(`No did authentication found for did ${subject.id} in did document`)
    }

    const presentation = await this.w3cCredentialService.createPresentation({
      credentials: w3cVerifiableCredentials,
    })

    const signPresentationOptions: SignPresentationOptions = {
      presentation,
      purpose: proof.proofPurpose,
      signatureType: proof.type,
      verificationMethod: (didResolutionResult.didDocument?.authentication[0]).toString(),
      challenge: requestPresentation.options.challenge,
    }

    const signedPresentation = await this.w3cCredentialService.signPresentation(signPresentationOptions)

    const attachId = options.attachId ?? uuid()

    const format = new ProofFormatSpec({
      attachmentId: attachId,
      format: V2_PRESENTATION_EXCHANGE_PRESENTATION,
    })

    const attachment = new Attachment({
      id: attachId,
      mimeType: 'application/json',
      data: new AttachmentData({
        json: JsonTransformer.toJSON(signedPresentation),
      }),
    })

    return { format, attachment }
  }

  public async processPresentation(options: ProcessPresentationOptions): Promise<boolean> {
    if (!options.presentation) {
      throw Error('Presentation  missing while processing presentation in presentation exchange service.')
    }

    const requestFormat = options.presentation.request.find(
      (x) => x.format.format === V2_PRESENTATION_EXCHANGE_PRESENTATION_REQUEST
    )

    const proofFormat = options.presentation.proof.find(
      (x) => x.format.format === V2_PRESENTATION_EXCHANGE_PRESENTATION
    )

    const proofRequestJson = requestFormat?.attachment.getDataAsJson<Attachment>() ?? null

    const requestMessage = JsonTransformer.fromJSON(proofRequestJson, RequestPresentation)

    const proofPresentationRequestJson = proofFormat?.attachment.getDataAsJson<Attachment>() ?? null

    const w3cVerifiablePresentation = JsonTransformer.fromJSON(proofPresentationRequestJson, W3cVerifiablePresentation)

    const proof = JsonTransformer.fromJSON(w3cVerifiablePresentation.proof, LinkedDataProof)

    const verifyPresentationOptions: VerifyPresentationOptions = {
      presentation: w3cVerifiablePresentation,
      proofType: proof.type,
      verificationMethod: proof.verificationMethod,
      challenge: requestMessage.options.challenge,
    }

    const verifyResult = await this.w3cCredentialService.verifyPresentation(verifyPresentationOptions)

    return verifyResult.verified
  }

  public async getRequestedCredentialsForProofRequest(
    options: GetRequestedCredentialsFormat
  ): Promise<AutoSelectCredentialOptions> {
    const requestMessageJson = options.attachment.getDataAsJson<RequestPresentation>()
    const requestMessage = JsonTransformer.fromJSON(requestMessageJson, RequestPresentation)
    const presentationDefinition = JsonTransformer.fromJSON(
      requestMessage.presentationDefinition,
      PresentationDefinition
    )

    let credentialsList: W3cCredential[] = []
    for (const inputDescriptor of presentationDefinition.inputDescriptors) {
      const uriList = []

      const schemaUris = inputDescriptor.schema[0]
      uriList.push(schemaUris.uri)

      if (uriList.length === 0) {
        uriList.splice(0)
      }

      const searched = await this.w3cCredentialService.findCredentialByQuery({ contexts: uriList })

      if (searched.length === 0) {
        throw new AriesFrameworkError('No credential found')
      }

      credentialsList = searched
    }
    return {
      presentationExchange: credentialsList,
    }
  }

  public async autoSelectCredentialsForProofRequest(
    options: AutoSelectCredentialOptions
  ): Promise<RequestedCredentialsFormats> {
    const presentationExchange = options.presentationExchange

    if (!presentationExchange) {
      throw new AriesFrameworkError('No presentation options provided')
    }

    return {
      presentationExchange: await presentationExchange[0],
    }
    // throw new Error('Method not implemented.')
  }

  public proposalAndRequestAreEqual(
    proposalAttachments: ProofAttachmentFormat[],
    requestAttachments: ProofAttachmentFormat[]
  ): boolean {
    const proposalAttachment = proposalAttachments.find(
      (x) => x.format.format === V2_PRESENTATION_EXCHANGE_PRESENTATION_PROPOSAL
    )?.attachment
    const requestAttachment = requestAttachments.find(
      (x) => x.format.format === V2_PRESENTATION_EXCHANGE_PRESENTATION_REQUEST
    )?.attachment

    if (!proposalAttachment) {
      throw new AriesFrameworkError('Proposal message has no attachment linked to it')
    }

    if (!requestAttachment) {
      throw new AriesFrameworkError('Request message has no attachment linked to it')
    }

    const proposalAttachmentData = proposalAttachment.getDataAsJson<InputDescriptorsSchema>()
    const requestAttachmentData = requestAttachment.getDataAsJson<InputDescriptorsSchema>()

    if (
      proposalAttachmentData.inputDescriptors === requestAttachmentData.inputDescriptors &&
      proposalAttachmentData.inputDescriptors === requestAttachmentData.inputDescriptors
    ) {
      return true
    }

    return false
  }

  public supportsFormat(formatIdentifier: string): boolean {
    const supportedFormats = [
      V2_PRESENTATION_EXCHANGE_PRESENTATION_PROPOSAL,
      V2_PRESENTATION_EXCHANGE_PRESENTATION_REQUEST,
      V2_PRESENTATION_EXCHANGE_PRESENTATION,
    ]
    return supportedFormats.includes(formatIdentifier)
  }

  private async retrieveUriListFromSchemaFilter(schemaUriGroups: SchemaOptions[][]): Promise<string[]> {
    // Retrieve list of schema uri from uri_group.
    const groupSchemaUriList = []

    for (const schemaGroup of schemaUriGroups) {
      const uriList = []
      for (const schema in schemaGroup) {
        uriList.push(schema)
      }
      if (uriList.length > 0) {
        groupSchemaUriList.push(uriList)
      }
    }
    return ['']
  }
}
