// import type { ProofRequest, ProofStateChangedEvent } from '..'
// import type { AgentMessage } from '../../../agent/AgentMessage'
// import type { HandlerInboundMessage } from '../../../agent/Handler'
// import type { Logger } from '../../../logger'
// import type {
//   CreateRequestOptions,
//   ProofRequestAsResponse,
//   ProofRequestsOptions,
//   ProposeProofOptions,
//   RequestProofOptions,
// } from '../../interface'
// import type { ProofRecordProps } from '../repository'
// import type { PresentationPreview } from '../v1/models/PresentationPreview'
// import type { ProofFormatService } from './formats/ProofFormatService'
// import type { V2ProposePresentationMessageOptions } from './messages/V2ProposalPresentationMessage'

// import { inject, Lifecycle, scoped } from 'tsyringe'

// import {
//   INDY_PROOF_REQUEST_ATTACHMENT_ID,
//   RequestPresentationMessage,
//   RequestedAttribute,
//   RequestedPredicate,
//   RetrievedCredentials,
//   ProofEventTypes,
//   ProofState,
// } from '..'
// import { AgentConfig } from '../../../agent/AgentConfig'
// import { Dispatcher } from '../../../agent/Dispatcher'
// import { EventEmitter } from '../../../agent/EventEmitter'
// import { InjectionSymbols } from '../../../constants'
// import { Attachment, AttachmentData } from '../../../decorators/attachment/Attachment'
// import { JsonEncoder } from '../../../utils/JsonEncoder'
// import { JsonTransformer } from '../../../utils/JsonTransformer'
// import { Wallet } from '../../../wallet/Wallet'
// import { ConnectionService } from '../../connections/services'
// import { Credential } from '../../credentials'
// import { IndyHolderService } from '../../indy'
// import { ProofResponseCoordinator } from '../ProofResponseCoordinator'
// import { ProofService } from '../ProofService'
// import { ProofProtocolVersion } from '../models/ProofProtocolVersion'
// import { ProofRepository, ProofRecord } from '../repository'
// import { PresentationRecordType } from '../repository/PresentationExchangeRecord'

// import { IndyProofFormatService } from './formats/indy/IndyProofFormatService'
// import { JsonLdProofFormatService } from './formats/jsonld/JsonLdProofFormatService'
// import { V2ProposePresentationHandler } from './handlers/V2ProposePresentationHandler'
// import { V2ProposalPresentationMessage } from './messages/V2ProposalPresentationMessage'

// scoped(Lifecycle.ContainerScoped)
// export class V2ProofService extends ProofService {
//   requestProof(requestProofOptions: RequestProofOptions): Promise<{ proofRecord: ProofRecord; message: AgentMessage }> {
//     throw new Error('Method not implemented.')
//   }

//   createRequest(
//     createRequestOptions: CreateRequestOptions
//   ): Promise<{ proofRecord: ProofRecord; message: AgentMessage }> {
//     throw new Error('Method not implemented.')
//   }

//   private proofRepository: ProofRepository
//   private connectionService: ConnectionService
//   private eventEmitter: EventEmitter
//   private agentConfig: AgentConfig
//   private proofResponseCoordinator: ProofResponseCoordinator
//   private dispatcher: Dispatcher
//   private logger: Logger
//   private indyHolderService: IndyHolderService
//   private wallet: Wallet

//   public constructor(
//     proofRepository: ProofRepository,
//     connectionService: ConnectionService,
//     eventEmitter: EventEmitter,
//     agentConfig: AgentConfig,
//     dispatcher: Dispatcher,
//     proofResponseCoordinator: ProofResponseCoordinator,
//     @inject(InjectionSymbols.Wallet) wallet: Wallet,
//     indyHolderService: IndyHolderService
//   ) {
//     super()
//     this.proofRepository = proofRepository
//     this.connectionService = connectionService
//     this.eventEmitter = eventEmitter
//     this.agentConfig = agentConfig
//     this.dispatcher = dispatcher
//     this.proofResponseCoordinator = proofResponseCoordinator
//     this.logger = agentConfig.logger
//     this.indyHolderService = indyHolderService
//     this.wallet = wallet
//   }

//   public getFormatService(_proofRecordType: PresentationRecordType): ProofFormatService {
//     const serviceFormatMap = {
//       [PresentationRecordType.Indy]: IndyProofFormatService,
//       [PresentationRecordType.W3c]: JsonLdProofFormatService,
//     }
//     return new serviceFormatMap[_proofRecordType](this.proofRepository, this.eventEmitter)
//   }

//   public getVersion(): ProofProtocolVersion {
//     return ProofProtocolVersion.V1_0
//   }

//   public async createProposal(
//     proposal: ProposeProofOptions
//   ): Promise<{ proofRecord: ProofRecord; message: AgentMessage }> {
//     this.logger.debug('----------- In V2 Proof Service  -----------------\n')

//     const connection = await this.connectionService.getById(proposal.connectionId)

//     const presentationRecordType = proposal.proofFormats?.indy
//       ? PresentationRecordType.Indy
//       : PresentationRecordType.W3c

//     this.logger.debug('Get the Format Service and Create Proposal Message')

//     const formatService: ProofFormatService = this.getFormatService(presentationRecordType)

//     console.log('V2 Service [createProposal] formatService: ', formatService)

//     const { preview, formats, filtersAttach } = formatService.getProofProposeAttachFormats(proposal, 'PRES_20_PROPOSAL')

//     const v2ProposePresentationMessageOptions: V2ProposePresentationMessageOptions = {
//       id: formatService.generateId(),
//       formats,
//       filtersAttach,
//       comment: proposal.comment,
//       presentationProposal: preview,
//     }

//     console.log('[ProofMessageBuilder] v2ProposePresentationMessageOptions:', v2ProposePresentationMessageOptions)
//     const message: V2ProposalPresentationMessage = new V2ProposalPresentationMessage(
//       v2ProposePresentationMessageOptions
//     )

//     const props: ProofRecordProps = {
//       connectionId: proposal.connectionId,
//       threadId: connection.threadId ? connection.threadId : '',
//       state: ProofState.ProposalSent,
//       autoAcceptProof: proposal?.autoAcceptProof,
//     }

//     // Create record

//     const proofRecord = new ProofRecord(props)
//     proofRecord.proposalMessage = message // new V2 field

//     this.logger.debug('Save meta data and emit state change event')
//     await formatService.setMetaDataAndEmitEventForProposal(proposal.proofFormats, proofRecord)

//     return { proofRecord, message }
//   }

//   public async processProposal(
//     messageContext: HandlerInboundMessage<V2ProposePresentationHandler>
//   ): Promise<ProofRecord> {
//     console.log('V2 [processProposal] messageContext:', messageContext)

//     let proofRecord: ProofRecord
//     const { message: proposalMessage, connection } = messageContext

//     try {
//       proofRecord = await this.getByThreadAndConnectionId(proposalMessage.threadId, connection?.id)

//       console.log('V2 [processProposal] proofRecord:', proofRecord)

//       proofRecord.assertState(ProofState.PresentationSent)
//       proofRecord.assertState(ProofState.RequestSent)
//       this.connectionService.assertConnectionOrServiceDecorator(messageContext, {
//         previousReceivedMessage: proofRecord.proposalMessage,
//         previousSentMessage: proofRecord.requestMessage,
//       })

//       // Update record
//       // proofRecord.proposalMessage = proposalMessage
//       await this.updateState(proofRecord, ProofState.ProposalReceived)
//     } catch {
//       // No proof record exists with thread id
//       proofRecord = new ProofRecord({
//         connectionId: connection?.id,
//         threadId: proposalMessage.threadId,
//         // proposalMessage: proposalMessage,
//         state: ProofState.ProposalReceived,
//       })

//       // Assert
//       this.connectionService.assertConnectionOrServiceDecorator(messageContext)

//       // Save record
//       await this.proofRepository.save(proofRecord)
//       this.eventEmitter.emit<ProofStateChangedEvent>({
//         type: ProofEventTypes.ProofStateChanged,
//         payload: {
//           proofRecord,
//           previousState: null,
//         },
//       })
//     }

//     return proofRecord
//   }

//   public createProofRequestFromProposal(
//     presentationProposal: PresentationPreview,
//     proofRequestOptions: ProofRequestsOptions
//   ): Promise<ProofRequest> {
//     throw new Error('Method not implemented.')
//   }

//   public async createRequestAsResponse(
//     proofRequestAsResponse: ProofRequestAsResponse
//   ): Promise<{ message: AgentMessage; proofRecord: ProofRecord }> {
//     // TODO WORK on V2 If required
//     const { proofRecord, proofRequest, comment } = proofRequestAsResponse

//     // Assert
//     proofRecord.assertState(ProofState.ProposalReceived)

//     // Create message
//     const attachment = new Attachment({
//       id: INDY_PROOF_REQUEST_ATTACHMENT_ID,
//       mimeType: 'application/json',
//       data: new AttachmentData({
//         base64: JsonEncoder.toBase64(proofRequest),
//       }),
//     })
//     const requestPresentationMessage = new RequestPresentationMessage({
//       comment: comment,
//       requestPresentationAttachments: [attachment],
//     })
//     requestPresentationMessage.setThread({
//       threadId: proofRecord.threadId,
//     })

//     // Update record
//     proofRecord.requestMessage = requestPresentationMessage
//     await this.updateState(proofRecord, ProofState.RequestSent)

//     return { message: requestPresentationMessage, proofRecord }
//   }

//   private async getByThreadAndConnectionId(threadId: string, connectionId?: string): Promise<ProofRecord> {
//     return this.proofRepository.getSingleByQuery({
//       connectionId,
//       threadId,
//     })
//   }

//   public async getRequestedCredentialsForProofRequest(
//     proofRequest: ProofRequest,
//     presentationProposal?: PresentationPreview
//   ): Promise<RetrievedCredentials> {
//     const retrievedCredentials = new RetrievedCredentials({})

//     for (const [referent, requestedAttribute] of proofRequest.requestedAttributes.entries()) {
//       let credentialMatch: Credential[] = []
//       const credentials = await this.getCredentialsForProofRequest(proofRequest, referent)

//       // If we have exactly one credential, or no proposal to pick preferences
//       // on the credentials to use, we will use the first one
//       if (credentials.length === 1 || !presentationProposal) {
//         credentialMatch = credentials
//       }
//       // If we have a proposal we will use that to determine the credentials to use
//       else {
//         const names = requestedAttribute.names ?? [requestedAttribute.name]

//         // Find credentials that matches all parameters from the proposal
//         credentialMatch = credentials.filter((credential) => {
//           const { attributes, credentialDefinitionId } = credential.credentialInfo

//           // Check if credentials matches all parameters from proposal
//           return names.every((name) =>
//             presentationProposal.attributes.find(
//               (a) =>
//                 a.name === name &&
//                 a.credentialDefinitionId === credentialDefinitionId &&
//                 (!a.value || a.value === attributes[name])
//             )
//           )
//         })
//       }

//       retrievedCredentials.requestedAttributes[referent] = credentialMatch.map((credential: Credential) => {
//         return new RequestedAttribute({
//           credentialId: credential.credentialInfo.referent,
//           revealed: true,
//           credentialInfo: credential.credentialInfo,
//         })
//       })
//     }

//     for (const [referent] of proofRequest.requestedPredicates.entries()) {
//       const credentials = await this.getCredentialsForProofRequest(proofRequest, referent)

//       retrievedCredentials.requestedPredicates[referent] = credentials.map((credential) => {
//         return new RequestedPredicate({
//           credentialId: credential.credentialInfo.referent,
//           credentialInfo: credential.credentialInfo,
//         })
//       })
//     }

//     return retrievedCredentials
//   }

//   private async getCredentialsForProofRequest(
//     proofRequest: ProofRequest,
//     attributeReferent: string
//   ): Promise<Credential[]> {
//     const credentialsJson = await this.indyHolderService.getCredentialsForProofRequest({
//       proofRequest: proofRequest.toJSON(),
//       attributeReferent,
//     })

//     return JsonTransformer.fromJSON(credentialsJson, Credential) as unknown as Credential[]
//   }

//   public async generateProofRequestNonce() {
//     return this.wallet.generateNonce()
//   }

//   /**
//    * Retrieve a proof record by id
//    *
//    * @param proofRecordId The proof record id
//    * @throws {RecordNotFoundError} If no record is found
//    * @return The proof record
//    *
//    */
//   public async getById(proofRecordId: string): Promise<ProofRecord> {
//     return this.proofRepository.getById(proofRecordId)
//   }

//   private async updateState(proofRecord: ProofRecord, newState: ProofState) {
//     const previousState = proofRecord.state
//     proofRecord.state = newState
//     await this.proofRepository.update(proofRecord)

//     this.eventEmitter.emit<ProofStateChangedEvent>({
//       type: ProofEventTypes.ProofStateChanged,
//       payload: { proofRecord, previousState: previousState },
//     })
//   }

//   public registerHandlers() {
//     this.dispatcher.registerHandler(
//       new V2ProposePresentationHandler(this, this.agentConfig, this.proofResponseCoordinator)
//     )
//   }
// }
