import type { SignPresentationOptions, VerifyPresentationOptions } from '../../../vc/models/W3cCredentialServiceOptions'
import type { W3cPresentation } from '../../../vc/models/presentation/W3Presentation'
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
import type { SchemaOptions, InputDescriptorsSchema } from './models'
import type { RequestPresentationOptions } from './models/RequestPresentation'
import type {
  ICredentialSubject,
  IVerifiableCredential,
  IVerifiablePresentation,
  PresentationSignCallBackParams,
  PresentationSignOptions,
  Validated,
} from '@sphereon/pex'
import type { PresentationDefinitionV1 } from '@sphereon/pex-models'

import { expand } from '@digitalcredentials/jsonld'
import { KeyEncoding, ProofPurpose, ProofType, Status, PEXv1 } from '@sphereon/pex'
import { Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from '../../../../agent/AgentConfig'
import { Attachment, AttachmentData } from '../../../../decorators/attachment/Attachment'
import { AriesFrameworkError } from '../../../../error'
import { DidCommMessageRepository } from '../../../../storage/didcomm/DidCommMessageRepository'
import { JsonTransformer } from '../../../../utils'
import { uuid } from '../../../../utils/uuid'
import { DidResolverService } from '../../../dids'
import { W3cCredentialService } from '../../../vc'
import { LinkedDataProof } from '../../../vc/models/LinkedDataProof'
import { W3cVerifiablePresentation } from '../../../vc/models/presentation/W3cVerifiablePresentation'
import { ProofFormatService } from '../ProofFormatService'
import {
  V2_PRESENTATION_EXCHANGE_PRESENTATION,
  V2_PRESENTATION_EXCHANGE_PRESENTATION_PROPOSAL,
  V2_PRESENTATION_EXCHANGE_PRESENTATION_REQUEST,
} from '../ProofFormats'
import { ProofFormatSpec } from '../models/ProofFormatSpec'

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

    const presentationExchangeFormat = options.formats.presentationExchange

    if (!presentationExchangeFormat.presentationDefinition) {
      throw Error('Presentation definition with Input Descriptor is missing while creating proof proposal.')
    }

    const presentationDefinition = presentationExchangeFormat.presentationDefinition

    const pex: PEXv1 = new PEXv1()
    const result: Validated = pex.validateDefinition(presentationDefinition)

    if (Array.isArray(result) && result[0].status !== Status.INFO) {
      throw new AriesFrameworkError(`Error in creating presentation definition: ${result[0].message} `)
    }

    const attachId = options.id ?? uuid()

    const format = new ProofFormatSpec({
      attachmentId: attachId,
      format: V2_PRESENTATION_EXCHANGE_PRESENTATION_PROPOSAL,
    })

    const attachment = new Attachment({
      id: attachId,
      mimeType: 'application/json',
      data: new AttachmentData({
        json: JsonTransformer.toJSON(presentationDefinition),
      }),
    })

    return { format, attachment }
  }

  public processProposal(options: ProcessProposalOptions): void {
    if (!options.proposal) {
      throw Error('Proposal message is missing while processing proof proposal.')
    }

    const proposalMessage = options.proposal

    const presentationDefinition = proposalMessage.attachment.getDataAsJson<PresentationDefinitionV1>()

    const pex: PEXv1 = new PEXv1()
    const result: Validated = pex.validateDefinition(presentationDefinition)

    if (Array.isArray(result) && result[0].status !== Status.INFO) {
      throw new AriesFrameworkError(
        `Error in presentation definition while processing presentation exchange proposal: ${result[0].message} `
      )
    }
  }

  public async createProofRequestFromProposal(options: CreatePresentationFormatsOptions): Promise<ProofRequestFormats> {
    const presentationDefinitionJson = options.presentationAttachment.getDataAsJson<PresentationDefinitionV1>() ?? null

    const pex: PEXv1 = new PEXv1()
    const result: Validated = pex.validateDefinition(presentationDefinitionJson)

    const presentationExchangeRequestMessage: RequestPresentationOptions = {
      options: {
        challenge: uuid(),
        domain: '',
      },
      presentationDefinition: presentationDefinitionJson,
    }

    if (Array.isArray(result) && result[0].status !== Status.INFO) {
      throw new AriesFrameworkError(`Error in creating presentation definition: ${result[0].message} `)
    }

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

    const presentationExchangeRequestMessage = options.formats.presentationExchange

    const attachId = options.attachId ?? uuid()

    const format = new ProofFormatSpec({
      attachmentId: attachId,
      format: V2_PRESENTATION_EXCHANGE_PRESENTATION_REQUEST,
    })

    const attachment = new Attachment({
      id: attachId,
      mimeType: 'application/json',
      data: new AttachmentData({
        json: JsonTransformer.toJSON(presentationExchangeRequestMessage),
      }),
    })

    return { format, attachment }
  }

  public async createRequest(options: CreateRequestOptions): Promise<ProofAttachmentFormat> {
    if (!options.formats.presentationExchange) {
      throw Error('Presentation Exchange format missing')
    }

    const requestPresentation = options.formats.presentationExchange as RequestPresentationOptions

    if (!requestPresentation.presentationDefinition.input_descriptors) {
      throw Error('Input Descriptor missing while creating the request in presentation exchange service.')
    }

    const presentationExchangeRequestMessage: RequestPresentationOptions = {
      options: {
        challenge: requestPresentation.options?.challenge ?? uuid(),
        domain: '',
      },
      presentationDefinition: requestPresentation.presentationDefinition,
    }

    const attachId = options.id ?? uuid()

    const format = new ProofFormatSpec({
      attachmentId: attachId,
      format: V2_PRESENTATION_EXCHANGE_PRESENTATION_REQUEST,
    })

    const attachment = new Attachment({
      id: attachId,
      mimeType: 'application/json',
      data: new AttachmentData({
        json: JsonTransformer.toJSON(presentationExchangeRequestMessage),
      }),
    })

    return { format, attachment }
  }

  public processRequest(options: ProcessRequestOptions): void {
    if (!options.request) {
      throw Error('Request message is missing while processing proof request in presentation exchange.')
    }

    const requestMessage = options.request

    const presentationDefinition = requestMessage.attachment.getDataAsJson<PresentationDefinitionV1>()

    const pex: PEXv1 = new PEXv1()
    const result: Validated = pex.validateDefinition(presentationDefinition)

    if (Array.isArray(result) && result[0].status !== Status.INFO) {
      throw new AriesFrameworkError(
        `Error in presentation definition while processing presentation exchange request: ${result[0].message} `
      )
    }
  }

  public async createPresentation(options: CreatePresentationOptions): Promise<ProofAttachmentFormat> {
    if (!options.formats.presentationExchange) {
      throw Error('Presentation Exchange format missing while creating presentation in presentation exchange service.')
    }

    const requestPresentation = options.attachment.getDataAsJson<RequestPresentationOptions>()

    // console.log('presentationDefinition:\n', JSON.stringify(requestPresentation.presentationDefinition, null, 2))

    const credential = options.formats.presentationExchange

    const pex: PEXv1 = new PEXv1()

    const subject: ICredentialSubject = credential.credentialSubject as ICredentialSubject

    if (!subject?.id) {
      throw new AriesFrameworkError(
        'Credential subject missing from the selected credential for creating presentation.'
      )
    }

    const didResolutionResult = await this.didResolver.resolve(subject.id)

    if (!didResolutionResult.didDocument) {
      throw new AriesFrameworkError(`No did document found for did ${subject.id}`)
    }

    if (!didResolutionResult.didDocument?.authentication) {
      throw new AriesFrameworkError(`No did authentication found for did ${subject.id} in did document`)
    }

    if (!didResolutionResult.didDocument?.verificationMethod) {
      throw new AriesFrameworkError(`No did verification method found for did ${subject.id} in did document`)
    }

    const params: PresentationSignOptions = {
      holder: subject.id,
      proofOptions: {
        type: ProofType.Ed25519Signature2018, // TO-CHECK - signature in the presentation or get it from DIDDoc
        proofPurpose: ProofPurpose.assertionMethod,
        challenge: requestPresentation.options?.challenge,
      },
      signatureOptions: {
        verificationMethod: (didResolutionResult.didDocument?.authentication[0]).toString(),
        keyEncoding: KeyEncoding.Base58,
        privateKey: didResolutionResult.didDocument.verificationMethod[0].publicKeyBase58,
      },
    }

    const verifiablePresentation = pex.verifiablePresentationFrom(
      requestPresentation.presentationDefinition,
      [options.formats.presentationExchange], // TBD required an IVerifiableCredential[] but AutoSelectCredential returns single credential
      this.signedProofCallBack.bind(this),
      params
    )

    const attachId = options.id ?? uuid()

    const format = new ProofFormatSpec({
      attachmentId: attachId,
      format: V2_PRESENTATION_EXCHANGE_PRESENTATION,
    })

    const attachment = new Attachment({
      id: attachId,
      mimeType: 'application/json',
      data: new AttachmentData({
        json: JsonTransformer.toJSON(verifiablePresentation),
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

    const proofAttachment = requestFormat?.attachment.getDataAsJson<Attachment>() ?? null

    const requestMessage: RequestPresentationOptions = proofAttachment as unknown as RequestPresentationOptions

    // const pex: PEXv1 = new PEXv1()
    // pex.evaluatePresentation(presentationDefinition, verifiablePresentation)
    const proofPresentationRequestJson = proofFormat?.attachment.getDataAsJson<Attachment>() ?? null
    // console.log(
    //   'proofPresentationRequestJson in process Presentation:==========\n',
    //   JSON.stringify(proofPresentationRequestJson, null, 2)
    // )

    const w3cVerifiablePresentation = JsonTransformer.fromJSON(proofPresentationRequestJson, W3cVerifiablePresentation)

    const proof = JsonTransformer.fromJSON(w3cVerifiablePresentation.proof, LinkedDataProof)

    const verifyPresentationOptions: VerifyPresentationOptions = {
      presentation: w3cVerifiablePresentation,
      proofType: proof.type,
      verificationMethod: proof.verificationMethod,
      challenge: requestMessage.options?.challenge,
    }

    const verifyResult = await this.w3cCredentialService.verifyPresentation(verifyPresentationOptions)

    return verifyResult.verified
  }

  public async getRequestedCredentialsForProofRequest(
    options: GetRequestedCredentialsFormat
  ): Promise<AutoSelectCredentialOptions> {
    const requestMessageJson = options.attachment.getDataAsJson<RequestPresentationOptions>()

    const presentationDefinition = requestMessageJson.presentationDefinition

    const expandedTypes = await expand(JsonTransformer.toJSON(presentationDefinition), {
      documentLoader: await this.w3cCredentialService.documentLoader,
    })

    let uriList: string[] = []
    for (const inputDescriptor of presentationDefinition.input_descriptors) {
      uriList = inputDescriptor.schema.map((s) => s.uri)

      if (uriList.length === 0) {
        uriList.splice(0)
      }
    }

    const credentialsByContext = await this.w3cCredentialService.findCredentialByQuery({
      contexts: uriList,
    })

    const credentialsByExpandedType = await this.w3cCredentialService.findCredentialByQuery({
      expandedTypes,
    })

    const credentials = [...credentialsByContext, ...credentialsByExpandedType]

    const pexCredentials = credentials.map((c) => JsonTransformer.toJSON(c) as IVerifiableCredential)

    const pex: PEXv1 = new PEXv1()
    const selectResults = pex.selectFrom(presentationDefinition, pexCredentials)

    return {
      presentationExchange: selectResults,
    }
  }

  public async autoSelectCredentialsForProofRequest(
    options: AutoSelectCredentialOptions
  ): Promise<RequestedCredentialsFormats> {
    const presentationExchange = options.presentationExchange

    if (!presentationExchange) {
      throw new AriesFrameworkError('No presentation options provided')
    }

    if (!presentationExchange.verifiableCredential || presentationExchange.verifiableCredential.length === 0) {
      throw new AriesFrameworkError('')
    }

    return {
      presentationExchange: presentationExchange.verifiableCredential[0],
    }
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

  private signedProofCallBack(callBackParams: PresentationSignCallBackParams): IVerifiablePresentation {
    // console.log('callBackParams:\n', JSON.stringify(callBackParams, null, 2))

    // Prereq is properly filled out `proofOptions` and `signatureOptions`, together with a `proofValue` or `jws` value.
    // And thus a generated signature
    const { presentation, proof, options } = callBackParams // The created partial proof and presentation, as well as original supplied options
    const { signatureOptions, proofOptions } = options // extract the orignially supploed signature and proof Options
    const privateKeyBase58 = signatureOptions?.privateKey // Please check keyEncoding from signatureOptions first!

    if (!proofOptions?.type) {
      throw new AriesFrameworkError('Missing proof type in proof options for signing the presentation.')
    }

    if (!signatureOptions?.verificationMethod) {
      throw new AriesFrameworkError('Missing verification method in signature options for signing the presentation.')
    }

    if (!proofOptions?.challenge) {
      throw new AriesFrameworkError('Missing challenge in proof options for signing the presentation.')
    }

    /**
     * IProof looks like this:
     * {
     *    type: 'Ed25519Signature2018',
     *    created: '2021-12-01T20:10:45.000Z',
     *    proofPurpose: 'assertionMethod',
     *    verificationMethod: 'did:example:"1234......#key',
     *    .....
     * }
     */
    const w3Presentation = presentation as unknown as W3cPresentation

    const signPresentationOptions: SignPresentationOptions = {
      presentation: w3Presentation,
      purpose: proof.proofPurpose,
      signatureType: proofOptions?.type,
      verificationMethod: signatureOptions?.verificationMethod,
      challenge: proofOptions.challenge,
    }
    // const promise= new Promise()
    // Just an example. Obviously your lib will have a different method signature
    // const vp = (await this.w3cCredentialService.signPresentation(
    //   signPresentationOptions
    // )) as unknown as IVerifiablePresentation
    // console.log('vp:\n', vp)

    const vp: IVerifiablePresentation = this.returnSign(signPresentationOptions) as unknown as IVerifiablePresentation
    return vp
  }

  public async returnSign(param: SignPresentationOptions): Promise<W3cVerifiablePresentation> {
    try {
      // return new Promise(async (resolve, reject) => {
      return await this.w3cCredentialService.signPresentation(param)
      //   resolve(response)
      // })
    } catch (error) {
      console.error('Error in promise method')
      throw error
    }
  }
}
