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
import type { InputDescriptorsSchema } from './models'
import type { RequestPresentationOptions } from './models/RequestPresentation'
import type {
  ICredentialSubject,
  IPresentation,
  IVerifiableCredential,
  IVerifiablePresentation,
  PresentationSignCallBackParams,
  PresentationSignOptions,
  Validated,
} from '@sphereon/pex'
import type { PresentationDefinitionV1 } from '@sphereon/pex-models'

import { KeyEncoding, ProofPurpose, ProofType, Status, PEXv1 } from '@sphereon/pex'
import { Lifecycle, scoped } from 'tsyringe'

import jsonld from '../../../../../types/jsonld'
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

  public async processProposal(options: ProcessProposalOptions): Promise<void> {
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

    if (Array.isArray(result) && result[0].status !== Status.INFO) {
      throw new AriesFrameworkError(`Error in creating presentation definition: ${result[0].message} `)
    }

    const presentationExchangeRequestMessage: RequestPresentationOptions = {
      options: {
        challenge: uuid(),
        domain: '',
      },
      presentationDefinition: presentationDefinitionJson,
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
    const presentationDefinitionJson = requestPresentation.presentationDefinition as PresentationDefinitionV1

    const pex: PEXv1 = new PEXv1()
    const result: Validated = pex.validateDefinition(presentationDefinitionJson)

    if (Array.isArray(result) && result[0].status !== Status.INFO) {
      throw new AriesFrameworkError(
        `Error in presentation definition while creating presentation request: ${result[0].message} `
      )
    }

    const presentationExchangeRequestMessage: RequestPresentationOptions = {
      options: {
        challenge: uuid(),
        domain: '',
      },
      presentationDefinition: presentationDefinitionJson,
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

  public async processRequest(options: ProcessRequestOptions): Promise<void> {
    if (!options.formatAttachments) {
      throw Error('Request message is missing while processing proof request in presentation exchange.')
    }

    const requestMessage = options.formatAttachments

    const requestPresentation = requestMessage.attachment.getDataAsJson<RequestPresentationOptions>()

    const pex: PEXv1 = new PEXv1()
    const result: Validated = pex.validateDefinition(requestPresentation.presentationDefinition)

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

    const credential = options.formats.presentationExchange

    const pex: PEXv1 = new PEXv1()

    const subject: ICredentialSubject = credential.credentialSubject as ICredentialSubject

    // Credential is allowed to be presented without a subject id. In that case we can't prove ownerhsip of credential
    // And it is more like a bearer token.
    // In the future we can first check the holder key and if it exists we can use that as the one that should authenticate
    // https://www.w3.org/TR/vc-data-model/#example-a-credential-issued-to-a-holder-who-is-not-the-only-subject-of-the-credential-who-has-no-relationship-with-the-subject-of-the-credential-but-who-has-a-relationship-with-the-issuer
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

    const proofPurpose = ProofPurpose.assertionMethod

    if (!didResolutionResult.didDocument[proofPurpose]) {
      throw new AriesFrameworkError('')
    }

    // the signature suite to use for the presentation is dependant on the credentials we share.
    // 1. loop over all credentials that will be included in the proof

    const presentation = {
      verifiableCredentials: [
        {
          credentialSubject: {
            id: 'did:key:z456', // ed25519 did:key
          },
          proof: {
            type: 'Ed25519Signature2018',
          },
        },
        {
          credentialSubject: {
            another: 'key',
            id: 'did:key:z123', // bls12381g2 did:key
          },
          proof: {
            type: 'BbsBlsSignatureProof2020',
          },
        },

        {
          credentialSubject: {
            a: 'key',
            id: 'did:key:z123', // bls12381g2 did:key
          },
          proof: {
            type: 'BbsBlsSignatureProof2020',
          },
        },
      ],
      // how do get multiple proofs on the object?
      proof: [
        {
          type: 'BbsBlsSignature2020',
          verificationMethod: 'did:key:z123#a-key-id',
        },
        {
          type: 'Ed25519Signature2018',
          verificationMethod: 'did:key:z456#a-key-id',
        },
      ],
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

    const verifiablePresentation = await pex.verifiablePresentationFromAsync(
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
    if (!options.formatAttachments) {
      throw Error('Presentation  missing while processing presentation in presentation exchange service.')
    }

    const requestFormat = options.formatAttachments.request.find(
      (x) => x.format.format === V2_PRESENTATION_EXCHANGE_PRESENTATION_REQUEST
    )

    const proofFormat = options.formatAttachments.presentation.find(
      (x) => x.format.format === V2_PRESENTATION_EXCHANGE_PRESENTATION
    )

    const proofAttachment = requestFormat?.attachment.getDataAsJson<Attachment>() ?? null

    const requestMessage: RequestPresentationOptions = proofAttachment as unknown as RequestPresentationOptions

    const proofPresentationRequestJson = proofFormat?.attachment.getDataAsJson<Attachment>() ?? null

    const w3cVerifiablePresentation = JsonTransformer.fromJSON(proofPresentationRequestJson, W3cVerifiablePresentation)

    const proof = JsonTransformer.fromJSON(w3cVerifiablePresentation.proof, LinkedDataProof)

    const verifiablePresentation = w3cVerifiablePresentation as unknown as IPresentation

    const pex: PEXv1 = new PEXv1()
    pex.evaluatePresentation(requestMessage.presentationDefinition, verifiablePresentation)

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

    const expandedTypes = await jsonld.expand(JsonTransformer.toJSON(presentationDefinition), {
      documentLoader: this.w3cCredentialService.documentLoader,
    })

    let uriList: string[] = []
    for (const inputDescriptor of presentationDefinition.input_descriptors) {
      uriList = [...uriList, ...inputDescriptor.schema.map((s) => s.uri)]
    }

    const credentialsByContext = await this.w3cCredentialService.findCredentialsByQuery({
      contexts: uriList,
    })

    const credentialsByExpandedType = await this.w3cCredentialService.findCredentialsByQuery({
      expandedTypes: expandedTypes,
    })

    const credentials = [...credentialsByContext, ...credentialsByExpandedType]

    const pexCredentials = credentials.map((c) => JsonTransformer.toJSON(c) as IVerifiableCredential)

    const pex: PEXv1 = new PEXv1()
    const selectResults = pex.selectFrom(presentationDefinition, pexCredentials)

    if (selectResults.verifiableCredential?.length === 0) {
      throw new AriesFrameworkError('No matching credentials found.')
    }

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

    // check if this is INFO / (maybe WARNING. check when this is warning?)
    presentationExchange.areRequiredCredentialsPresent

    // 100 credentials in the credential list
    // 4 groups in total that satisfy the proof request
    //  for each group I need to know which credentials it needs

    // How to auto select the credentials:
    //  1. loop over all matches and find the first match for each submission requirement
    //  2. then for each match we extract the associated credentials from the `presentationExchange.verifiableCredential` array
    // We probably also need to return the selected matches we used so we can use those to create the presentation submission

    // Check how to correlate it. I think we may need to do something with the count here?
    // presentationExchange.matches[0].count

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

  private signedProofCallBack(callBackParams: PresentationSignCallBackParams): IVerifiablePresentation {
    const { presentation, proof, options } = callBackParams // The created partial proof and presentation, as well as original supplied options
    const { signatureOptions, proofOptions } = options // extract the originally supplied signature and proof Options

    if (!proofOptions?.type) {
      throw new AriesFrameworkError('Missing proof type in proof options for signing the presentation.')
    }

    if (!signatureOptions?.verificationMethod) {
      throw new AriesFrameworkError('Missing verification method in signature options for signing the presentation.')
    }

    if (!proofOptions?.challenge) {
      throw new AriesFrameworkError('Missing challenge in proof options for signing the presentation.')
    }

    const w3Presentation = presentation as unknown as W3cPresentation

    const signPresentationOptions: SignPresentationOptions = {
      presentation: w3Presentation,
      purpose: proof.proofPurpose,
      signatureType: proofOptions?.type,
      verificationMethod: signatureOptions?.verificationMethod,
      challenge: proofOptions.challenge,
    }

    return this.w3cCredentialService.signPresentation(signPresentationOptions) as unknown as IVerifiablePresentation
  }
}
