import type { AgentContext } from '../../../../agent'
import type { Key } from '../../../../crypto/Key'
import type { Attachment } from '../../../../decorators/attachment/Attachment'
import type { Query } from '../../../../storage/StorageService'
import type { W3cCredentialRecord } from '../../../vc'
import type { SignPresentationOptions, VerifyPresentationOptions } from '../../../vc/models/W3cCredentialServiceOptions'
import type { ProofAttachmentFormat } from '../ProofAttachmentFormat'
import type {
  FormatGetRequestedCredentials,
  FormatPresentationAttachment,
  FormatCreatePresentationOptions,
  FormatCreateProofRequestOptions,
  FormatCreateProofProposalOptions,
  FormatProcessPresentationOptions,
  FormatProcessProposalOptions,
  FormatProcessRequestOptions,
  FormatProofRequestOptions,
  FormatRequestPresentationExchangeOptions,
  FormatCreateRequestAsResponseOptions,
  FormatRequestedCredentialReturn,
  FormatRetrievedCredentialOptions,
} from '../ProofFormatServiceOptions'
import type { PresentationExchangeProofFormat } from './PresentationExchangeProofFormat'
import type { InputDescriptorsSchema } from './models'
import type { PresentationSignCallBackParams, PresentationSignOptions, Validated } from '@sphereon/pex'
import type { PresentationDefinitionV1 } from '@sphereon/pex-models'
import type {
  ICredentialSubject,
  IPresentation,
  IVerifiableCredential,
  IVerifiablePresentation,
} from '@sphereon/ssi-types'

import { KeyEncoding, Status, PEXv1 } from '@sphereon/pex'
import { IProofPurpose } from '@sphereon/ssi-types'
import { Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from '../../../../agent/AgentConfig'
import { AriesFrameworkError } from '../../../../error'
import { DidCommMessageRepository } from '../../../../storage/didcomm/DidCommMessageRepository'
import { deepEquality, JsonTransformer } from '../../../../utils'
import { uuid } from '../../../../utils/uuid'
import { DidResolverService, keyReferenceToKey, keyTypeToProofType, VerificationMethod } from '../../../dids'
import { W3cPresentation, W3cCredentialService } from '../../../vc'
import { LinkedDataProof } from '../../../vc/models/LinkedDataProof'
import { W3cVerifiablePresentation } from '../../../vc/models/presentation/W3cVerifiablePresentation'
import { ProofFormatSpec } from '../../models/ProofFormatSpec'
import { ProofFormatService } from '../ProofFormatService'

import {
  V2_PRESENTATION_EXCHANGE_PRESENTATION,
  V2_PRESENTATION_EXCHANGE_PRESENTATION_PROPOSAL,
  V2_PRESENTATION_EXCHANGE_PRESENTATION_REQUEST,
} from './PresentationExchangeProofFormat'

@scoped(Lifecycle.ContainerScoped)
export class PresentationExchangeProofFormatService extends ProofFormatService {
  private w3cCredentialService: W3cCredentialService
  private didResolver: DidResolverService
  private agentContext!: AgentContext

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
  public readonly formatKey = 'presentationExchange' as const

  public async createProposal(options: FormatCreateProofProposalOptions): Promise<ProofAttachmentFormat> {
    if (!options) {
      throw new AriesFrameworkError('Presentation Exchange format missing while creating proof proposal.')
    }

    const presentationExchangeFormat = options.formats.presentationExchange

    if (!presentationExchangeFormat?.presentationDefinition) {
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
    const attachment = this.getFormatData(presentationDefinition, format.attachmentId)

    return { format, attachment }
  }

  public async processProposal(options: FormatProcessProposalOptions): Promise<void> {
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

  public async createProofRequestFromProposal(
    options: FormatPresentationAttachment
  ): Promise<FormatProofRequestOptions> {
    const presentationDefinitionJson = options.presentationAttachment.getDataAsJson<PresentationDefinitionV1>()

    const pex: PEXv1 = new PEXv1()
    const result: Validated = pex.validateDefinition(presentationDefinitionJson)

    if (Array.isArray(result) && result[0].status !== Status.INFO) {
      throw new AriesFrameworkError(`Error in creating presentation definition: ${result[0].message} `)
    }

    const presentationExchangeRequestMessage: FormatRequestPresentationExchangeOptions = {
      options: {
        challenge: options.presentationOptions?.challenge ?? uuid(),
        domain: options.presentationOptions?.domain,
      },
      presentationDefinition: presentationDefinitionJson,
    }

    return {
      presentationExchange: presentationExchangeRequestMessage,
    }
  }

  public async createRequestAsResponse(
    options: FormatCreateRequestAsResponseOptions<[PresentationExchangeProofFormat]>
  ): Promise<ProofAttachmentFormat> {
    if (!options.proofFormats.presentationExchange) {
      throw Error('Presentation Exchange format missing while creating proof request as response.')
    }

    if (!options.proofFormats.presentationExchange) {
      throw Error('Input Descriptor missing while creating proof request as response.')
    }

    const presentationExchangeRequestMessage = options.proofFormats.presentationExchange

    const attachId = options.id ?? uuid()

    const format = new ProofFormatSpec({
      attachmentId: attachId,
      format: V2_PRESENTATION_EXCHANGE_PRESENTATION_REQUEST,
    })

    const attachment = this.getFormatData(presentationExchangeRequestMessage, format.attachmentId)

    return { format, attachment }
  }

  public async createRequest(options: FormatCreateProofRequestOptions): Promise<ProofAttachmentFormat> {
    if (!options.formats.presentationExchange) {
      throw Error('Presentation Exchange format missing')
    }

    const requestPresentation = options.formats.presentationExchange as FormatRequestPresentationExchangeOptions

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

    const presentationExchangeRequestMessage: FormatRequestPresentationExchangeOptions = {
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

    const attachment = this.getFormatData(presentationExchangeRequestMessage, format.attachmentId)

    return { format, attachment }
  }
  public async processRequest(options: FormatProcessRequestOptions): Promise<void> {
    if (!options.requestAttachment) {
      throw Error('Request message is missing while processing proof request in presentation exchange.')
    }

    const requestMessage = options.requestAttachment

    const requestPresentation = requestMessage.attachment.getDataAsJson<FormatRequestPresentationExchangeOptions>()

    const pex: PEXv1 = new PEXv1()
    const result: Validated = pex.validateDefinition(requestPresentation.presentationDefinition)

    if (Array.isArray(result) && result[0].status !== Status.INFO) {
      throw new AriesFrameworkError(
        `Error in presentation definition while processing presentation exchange request: ${result[0].message} `
      )
    }
  }

  public async createPresentation(
    agentContext: AgentContext,
    options: FormatCreatePresentationOptions<PresentationExchangeProofFormat>
  ): Promise<ProofAttachmentFormat> {
    if (!options.proofFormats.presentationExchange) {
      throw Error('Presentation Exchange format missing while creating presentation in presentation exchange service.')
    }

    console.log(">>QUACK PEX FORMAT SERVICE CREATE PRESENTATION...>>")

    const requestPresentation = options.attachment.getDataAsJson<FormatRequestPresentationExchangeOptions>()

    console.log(">> QUACK requestPresentation = ", requestPresentation)

    const credential: IVerifiableCredential = options.proofFormats.presentationExchange.formats

    const pex: PEXv1 = new PEXv1()

    const subject: ICredentialSubject = credential.credentialSubject as ICredentialSubject

    console.log(">> QUACK subject = ", subject)

    // Credential is allowed to be presented without a subject id. In that case we can't prove ownerhsip of credential
    // And it is more like a bearer token.
    // In the future we can first check the holder key and if it exists we can use that as the one that should authenticate
    // https://www.w3.org/TR/vc-data-model/#example-a-credential-issued-to-a-holder-who-is-not-the-only-subject-of-the-credential-who-has-no-relationship-with-the-subject-of-the-credential-but-who-has-a-relationship-with-the-issuer
    if (!subject?.id) {
      throw new AriesFrameworkError(
        'Credential subject missing from the selected credential for creating presentation.'
      )
    }

    console.log(">> QUACK going to resolve id  = ", subject.id)

    const didResolutionResult = await this.didResolver.resolve(agentContext, subject.id)

    console.log(">> QUACK didReesolutionResult = ", didResolutionResult)

    if (!didResolutionResult.didDocument) {
      throw new AriesFrameworkError(`No did document found for did ${subject.id}`)
    }

    if (
      !didResolutionResult.didDocument.authentication ||
      didResolutionResult.didDocument.authentication.length === 0
    ) {
      throw new AriesFrameworkError(`No did authentication found for did ${subject.id} in did document`)
    }

    if (!didResolutionResult.didDocument?.verificationMethod) {
      throw new AriesFrameworkError(`No did verification method found for did ${subject.id} in did document`)
    }

    const proofPurpose = IProofPurpose.authentication

    // the signature suite to use for the presentation is dependant on the credentials we share.

    // 1. Get the verification method for this given proof purpose in this DID document
    let [verificationMethod] = didResolutionResult.didDocument.authentication
    if (typeof verificationMethod === 'string') {
      verificationMethod = didResolutionResult.didDocument.dereferenceKey(verificationMethod, ['authentication'])
    }

    const proofType = this.w3cCredentialService.getProofTypeByVerificationMethodType(verificationMethod.type)

    // 2. Get the key for this given proof purpose in this DID document
    const keyId = didResolutionResult.didDocument[proofPurpose] as string[]

    // get keys from the did document section containing the proof purpose

    // 3. Map the Key Id to a key. Key contains publicKey and keyType attributes
    const privateKey: Key = keyReferenceToKey(didResolutionResult.didDocument, keyId[0])

    if (!proofType) {
      throw new AriesFrameworkError(`Unsupported key type: ${privateKey.keyType}`)
    }

    const params: PresentationSignOptions = {
      holder: subject.id,
      proofOptions: {
        type: proofType,
        proofPurpose: IProofPurpose.assertionMethod,
        challenge: requestPresentation.options?.challenge,
      },
      signatureOptions: {
        verificationMethod: verificationMethod.id,
      },
    }

    this.agentContext = agentContext

    console.log(">> QUACK GOING TO CREATE VERIFIABLE PRESENTATION------------------------------")
    console.log(">> QUACK 1. presentation defnition = ", requestPresentation.presentationDefinition)
    console.log(">> QUACK 2. formats 0 = ", options.proofFormats.presentationExchange.formats[0])
    console.log(">> QUACK 3. params = ", params)

    const verifiablePresentation = await pex.verifiablePresentationFromAsync(
      requestPresentation.presentationDefinition,
      [options.proofFormats.presentationExchange.formats], // TBD required an IVerifiableCredential[] but AutoSelectCredential returns single credential
      this.signedProofCallBack.bind(this),
      params
    )

    console.log(">> QUACK verifiablePresentation = ", verifiablePresentation)


    const attachId = options.id ?? uuid()

    const format = new ProofFormatSpec({
      attachmentId: attachId,
      format: V2_PRESENTATION_EXCHANGE_PRESENTATION,
    })

    const attachment = this.getFormatData(verifiablePresentation, format.attachmentId)

    return { format, attachment }
  }
  public async processPresentation(
    agentContext: AgentContext,
    options: FormatProcessPresentationOptions
  ): Promise<boolean> {
    if (!options.formatAttachments) {
      throw Error('Presentation missing while processing presentation in presentation exchange service.')
    }

    const requestFormat = options.formatAttachments.request.find(
      (x) => x.format.format === V2_PRESENTATION_EXCHANGE_PRESENTATION_REQUEST
    )

    const proofFormat = options.formatAttachments.presentation.find(
      (x) => x.format.format === V2_PRESENTATION_EXCHANGE_PRESENTATION
    )

    const proofAttachment = requestFormat?.attachment.getDataAsJson<FormatRequestPresentationExchangeOptions>()

    if (!proofAttachment) {
      throw new AriesFrameworkError('Could not derive proofAttachment from requestFormat')
    }
    const proofPresentationRequestJson: string | undefined = proofFormat?.attachment.getDataAsJson()

    if (!proofPresentationRequestJson) {
      throw new AriesFrameworkError('Attachment not found in proof format')
    }
    const w3cVerifiablePresentation = JsonTransformer.fromJSON(proofPresentationRequestJson, W3cVerifiablePresentation)

    // do we need to cast anything???
    // const verifiablePresentation = proofPresentationRequestJson as unknown as IPresentation

    // validate contents of presentation
    const pex: PEXv1 = new PEXv1()
    pex.evaluatePresentation(proofAttachment.presentationDefinition, proofPresentationRequestJson)

    // check the result
    const verifyPresentationOptions: VerifyPresentationOptions = {
      presentation: w3cVerifiablePresentation,
      challenge: proofAttachment.options?.challenge,
    }
    const verifyResult = await this.w3cCredentialService.verifyPresentation(agentContext, verifyPresentationOptions)

    return verifyResult.verified
  }

  public async getRequestedCredentialsForProofRequest(
    agentContext: AgentContext,
    options: FormatGetRequestedCredentials
  ): Promise<FormatRetrievedCredentialOptions<[PresentationExchangeProofFormat]>> {
    const requestMessageJson = options.attachment.getDataAsJson<FormatRequestPresentationExchangeOptions>()

    const presentationDefinition = requestMessageJson.presentationDefinition

    let uriList: string[] = []
    for (const inputDescriptor of presentationDefinition.input_descriptors) {
      uriList = [...uriList, ...inputDescriptor.schema.map((s) => s.uri)]
    }

    const query: Array<Query<W3cCredentialRecord>> = []
    for (const inputDescriptor of presentationDefinition.input_descriptors) {
      for (const schema of inputDescriptor.schema) {
        const innerQuery: Query<W3cCredentialRecord> = {}
        innerQuery.$or = [{ expandedType: [schema.uri] }, { contexts: [schema.uri] }]
        query.push(innerQuery)
      }
    }

    // query the wallet ourselves first to avoid the need to query the pex library for all
    // credentials for every proof request
    const credentials = await this.w3cCredentialService.findCredentialRecordsByQuery(agentContext, {
      $or: [...query],
    })

    const pexCredentials = credentials.map((c) => JsonTransformer.toJSON(c) as IVerifiableCredential)

    const pex: PEXv1 = new PEXv1()
    const selectResults = pex.selectFrom(presentationDefinition, pexCredentials)

    if (selectResults.verifiableCredential?.length === 0) {
      throw new AriesFrameworkError('No matching credentials found.')
    }

    return {
      proofFormats: {
        presentationExchange: {
          formats: selectResults,
        },
      },
    }
  }

  public async autoSelectCredentialsForProofRequest(
    options: FormatRetrievedCredentialOptions<[PresentationExchangeProofFormat]>
  ): Promise<FormatRequestedCredentialReturn<[PresentationExchangeProofFormat]>> {
    const presentationExchange = options.proofFormats.presentationExchange
    if (!presentationExchange) {
      throw new AriesFrameworkError('No presentation options provided')
    }

    if (
      !presentationExchange.formats.verifiableCredential ||
      presentationExchange.formats.verifiableCredential.length === 0
    ) {
      throw new AriesFrameworkError('No credentials provided')
    }

    // check if this is INFO / (maybe WARNING. check when this is warning?)
    presentationExchange.formats.areRequiredCredentialsPresent

    // TODO SubmissionRequests...

    // 100 credentials in the credential list
    // 4 groups in total that satisfy the proof request
    //  for each group I need to know which credentials it needs

    // How to auto select the credentials:

    //  1. loop over all matches and find the first match for each submission requirement
    //  2. then for each match we extract the associated credentials from the `presentationExchange.verifiableCredential` array
    // We probably also need to return the selected matches we used so we can use those to create the presentation submission

    // Check how to correlate it. I think we may need to do something with the count here?

    // note matches is array of SubmissionRequirementMatch
    // presentationExchange.formats.matches[0].count
    return {
      proofFormats: {
        presentationExchange: {
          formats: presentationExchange.formats.verifiableCredential[0],
        },
      },
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

    if (deepEquality(proposalAttachmentData.inputDescriptors, requestAttachmentData.inputDescriptors)) {
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

    if (!proofOptions?.challenge) {
      throw new AriesFrameworkError('Missing challenge in proof options for signing the presentation.')
    }

    if (!signatureOptions) {
      throw new AriesFrameworkError('Missing signature options in proof options for signing the presentation.')
    }

    const w3Presentation = JsonTransformer.fromJSON(presentation, W3cPresentation)
    const signPresentationOptions: SignPresentationOptions = {
      presentation: w3Presentation,
      purpose: proof.proofPurpose,
      signatureType: proofOptions.type,
      verificationMethod: signatureOptions.verificationMethod,
      challenge: proofOptions.challenge,
    }
    console.log(">>>>>>>>>>>>>>>> GOING TO SIGN PRESENTATION...>>>>>>>>>>>>>>>>>>>>>")

    const b = JsonTransformer.toJSON(
      this.w3cCredentialService.signPresentation(this.agentContext, signPresentationOptions)
    ) as IVerifiablePresentation

    console.log(">>>>>>>>>>>>>>>> DONE!--------------> b = ", b)

    return b
  }
}
