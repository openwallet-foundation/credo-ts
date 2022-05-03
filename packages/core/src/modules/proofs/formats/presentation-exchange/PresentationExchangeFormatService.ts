import type {
  AutoSelectCredentialOptions,
  ProofRequestFormats,
  RequestedCredentialsFormats,
} from '../../models/SharedOptions'
import type {
  GetRequestedCredentialsFormat,
  IndyGetRequestedCredentialsFormat,
} from '../IndyProofFormatsServiceOptions'
import type { ProofAttachmentFormat } from '../models/ProofAttachmentFormat'
import type {
  CreatePresentationFormatsOptions,
  CreatePresentationOptions,
  CreateProposalOptions,
  CreateRequestAsResponseOptions,
  CreateRequestOptions,
  ProcessPresentationOptions,
  ProcessProposalOptions,
} from '../models/ProofFormatServiceOptions'
import type { InputDescriptorsSchemaOptions, SchemaOptions } from './models'

import { BbsBlsSignature2020 } from '@mattrglobal/jsonld-signatures-bbs'
import { Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from '../../../../agent/AgentConfig'
import { Attachment, AttachmentData } from '../../../../decorators/attachment/Attachment'
import { DidCommMessageRepository } from '../../../../storage/didcomm/DidCommMessageRepository'
import { JsonTransformer } from '../../../../utils'
import { uuid } from '../../../../utils/uuid'
import { IndyHolderService, IndyVerifierService, IndyRevocationService } from '../../../indy'
import { IndyLedgerService } from '../../../ledger'
import { W3cCredentialService } from '../../../vc'
import { ProofFormatService } from '../ProofFormatService'
import { ATTACHMENT_FORMAT } from '../ProofFormats'
import { ProofFormatSpec } from '../models/ProofFormatSpec'

import { InputDescriptorsSchema } from './models'
import { ClaimFormatSchema, PresentationDefinition, RequestPresentation } from './models/RequestPresentation'

@scoped(Lifecycle.ContainerScoped)
export class PresentationExchangeFormatService extends ProofFormatService {
  private indyHolderService: IndyHolderService
  private indyVerifierService: IndyVerifierService
  private indyRevocationService: IndyRevocationService
  private ledgerService: IndyLedgerService
  private w3cCredentialService: W3cCredentialService

  public constructor(
    agentConfig: AgentConfig,
    indyHolderService: IndyHolderService,
    indyVerifierService: IndyVerifierService,
    indyRevocationService: IndyRevocationService,
    ledgerService: IndyLedgerService,
    didCommMessageRepository: DidCommMessageRepository,
    w3cCredentialService: W3cCredentialService
  ) {
    super(didCommMessageRepository, agentConfig)
    this.indyHolderService = indyHolderService
    this.indyVerifierService = indyVerifierService
    this.indyRevocationService = indyRevocationService
    this.ledgerService = ledgerService
    this.w3cCredentialService = w3cCredentialService
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
        challenge: '',
        domain: '',
      },
      presentationDefinition: presentationDefinition,
    })

    return {
      presentationExchange: presentationExchangeRequestMessage,
    }
  }

  public createProposal(options: CreateProposalOptions): Promise<ProofAttachmentFormat> {
    throw new Error('Method not implemented.')
  }

  public processProposal(options: ProcessProposalOptions): void {
    throw new Error('Method not implemented.')
  }

  public async createRequest(options: CreateRequestOptions): Promise<ProofAttachmentFormat> {
    if (!options.formats.presentationExchange) {
      throw Error('Presentation Exchange format missing')
    }

    if (!options.formats.presentationExchange.inputDescriptors) {
      throw Error('Input Descriptor missing')
    }

    const inputDescriptorsSchemaOptions: InputDescriptorsSchemaOptions = {
      inputDescriptors: options.formats.presentationExchange.inputDescriptors,
    }

    const proposalInputDescriptor = new InputDescriptorsSchema(inputDescriptorsSchemaOptions)
    const attachId = options.attachId ?? uuid()

    const format = new ProofFormatSpec({
      attachmentId: attachId,
      format: ATTACHMENT_FORMAT.V2_PRESENTATION_REQUEST.ldproof.format,
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

  public async createRequestAsResponse(options: CreateRequestAsResponseOptions): Promise<ProofAttachmentFormat> {
    if (!options.formats.presentationExchange) {
      throw Error('Presentation Exchange format missing')
    }

    if (!options.formats.presentationExchange) {
      throw Error('Input Descriptor missing')
    }

    const presentationExchangeRequestMessage: RequestPresentation = new RequestPresentation({
      options: options.formats.presentationExchange.options,
      presentationDefinition: options.formats.presentationExchange.presentationDefinition,
    })

    const attachId = options.attachId ?? uuid()

    const format = new ProofFormatSpec({
      attachmentId: attachId,
      format: ATTACHMENT_FORMAT.V2_PRESENTATION_REQUEST.ldproof.format,
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

  public createPresentation(options: CreatePresentationOptions): Promise<ProofAttachmentFormat> {
    throw new Error('Method not implemented.')
  }

  public processPresentation(options: ProcessPresentationOptions): Promise<boolean> {
    throw new Error('Method not implemented.')
  }

  public async getRequestedCredentialsForProofRequest(
    options: GetRequestedCredentialsFormat
  ): Promise<AutoSelectCredentialOptions> {
    console.log('options:\n\n', JSON.stringify(options.attachment, null, 2))

    const requestMessageJson = options.attachment.getDataAsJson<RequestPresentation>()
    const requestMessage = JsonTransformer.fromJSON(requestMessageJson, RequestPresentation)
    const presentationDefinition = JsonTransformer.fromJSON(
      requestMessage.presentationDefinition,
      PresentationDefinition
    )

    const claimFormat = JsonTransformer.fromJSON(presentationDefinition.format, ClaimFormatSchema)

    console.log('presentationDefinition in PE service', requestMessage.presentationDefinition)
    console.log('inputDescriptors in PE service', presentationDefinition.inputDescriptors)

    const credentialsList = []
    // const claimFormat = presentationDefinition.format
    let difHandlerProofType
    for (const inputDescriptor of presentationDefinition.inputDescriptors) {
      console.log('inputDescriptor', inputDescriptor)

      let proofType: string[] = []
      const limitDisclosure = inputDescriptor.constraints.limitDisclosure

      const uriList = []
      const oneOfUriGroups = []

      if (inputDescriptor.schema['oneOf_filter']) {
        oneOfUriGroups.push(await this.retrieveUriListFromSchemaFilter(inputDescriptor.schema['uri_groups']))
      } else {
        const schemaUris = inputDescriptor.schema[0]
        uriList.push(schemaUris.uri)
      }

      if (uriList.length === 0) {
        uriList.splice(0)
      }
      if (oneOfUriGroups.length === 0) {
        oneOfUriGroups.splice(0)
      }
      if (limitDisclosure) {
        proofType = BbsBlsSignature2020.proofType
        difHandlerProofType = BbsBlsSignature2020.proofType
      }

      // if (claimFormat) {
      //   if (claimFormat.ldpVp) {
      //     if (proofType.includes()) {

      //     }
      //   }
      // }
    }
    // this.w3cCredentialService.

    // for input_descriptor in input_descriptors:

    //     if len(uri_list) == 0:
    //         uri_list = None
    //     if len(one_of_uri_groups) == 0:
    //         one_of_uri_groups = None
    //     if limit_disclosure:
    //         proof_type = [BbsBlsSignature2020.signature_type]
    //         dif_handler_proof_type = BbsBlsSignature2020.signature_type
    //     if claim_fmt:
    //         if claim_fmt.ldp_vp:
    //             if "proof_type" in claim_fmt.ldp_vp:
    //                 proof_types = claim_fmt.ldp_vp.get("proof_type")
    //                 if limit_disclosure and (
    //                     BbsBlsSignature2020.signature_type not in proof_types
    //                 ):
    //                     raise V20PresFormatHandlerError(
    //                         "Verifier submitted presentation request with "
    //                         "limit_disclosure [selective disclosure] "
    //                         "option but verifier does not support "
    //                         "BbsBlsSignature2020 format"
    //                     )
    //                 elif (
    //                     len(proof_types) == 1
    //                     and (
    //                         BbsBlsSignature2020.signature_type
    //                         not in proof_types
    //                     )
    //                     and (
    //                         Ed25519Signature2018.signature_type
    //                         not in proof_types
    //                     )
    //                 ):
    //                     raise V20PresFormatHandlerError(
    //                         "Only BbsBlsSignature2020 and/or "
    //                         "Ed25519Signature2018 signature types "
    //                         "are supported"
    //                     )
    //                 elif (
    //                     len(proof_types) >= 2
    //                     and (
    //                         BbsBlsSignature2020.signature_type
    //                         not in proof_types
    //                     )
    //                     and (
    //                         Ed25519Signature2018.signature_type
    //                         not in proof_types
    //                     )
    //                 ):
    //                     raise V20PresFormatHandlerError(
    //                         "Only BbsBlsSignature2020 and "
    //                         "Ed25519Signature2018 signature types "
    //                         "are supported"
    //                     )
    //                 else:
    //                     for proof_format in proof_types:
    //                         if (
    //                             proof_format
    //                             == Ed25519Signature2018.signature_type
    //                         ):
    //                             proof_type = [
    //                                 Ed25519Signature2018.signature_type
    //                             ]
    //                             dif_handler_proof_type = (
    //                                 Ed25519Signature2018.signature_type
    //                             )
    //                             break
    //                         elif (
    //                             proof_format
    //                             == BbsBlsSignature2020.signature_type
    //                         ):
    //                             proof_type = [
    //                                 BbsBlsSignature2020.signature_type
    //                             ]
    //                             dif_handler_proof_type = (
    //                                 BbsBlsSignature2020.signature_type
    //                             )
    //                             break
    //         else:
    //             raise V20PresFormatHandlerError(
    //                 "Currently, only ldp_vp with "
    //                 "BbsBlsSignature2020 and Ed25519Signature2018"
    //                 " signature types are supported"
    //             )
    //     if one_of_uri_groups:
    //         records = []
    //         cred_group_record_ids = set()
    //         for uri_group in one_of_uri_groups:
    //             search = holder.search_credentials(
    //                 proof_types=proof_type, pd_uri_list=uri_group
    //             )
    //             max_results = 1000
    //             cred_group = await search.fetch(max_results)
    //             (
    //                 cred_group_vcrecord_list,
    //                 cred_group_vcrecord_ids_set,
    //             ) = await self.process_vcrecords_return_list(
    //                 cred_group, cred_group_record_ids
    //             )
    //             cred_group_record_ids = cred_group_vcrecord_ids_set
    //             records = records + cred_group_vcrecord_list
    //     else:
    //         search = holder.search_credentials(
    //             proof_types=proof_type, pd_uri_list=uri_list
    //         )
    //         # Defaults to page_size but would like to include all
    //         # For now, setting to 1000
    //         max_results = 1000
    //         records = await search.fetch(max_results)
    //     # Avoiding addition of duplicate records
    //     (
    //         vcrecord_list,
    //         vcrecord_ids_set,
    //     ) = await self.process_vcrecords_return_list(records, record_ids)
    //     record_ids = vcrecord_ids_set
    //     credentials_list = credentials_list + vcrecord_list

    throw new Error('Method not implemented.')
  }

  public autoSelectCredentialsForProofRequest(
    options: AutoSelectCredentialOptions
  ): Promise<RequestedCredentialsFormats> {
    throw new Error('Method not implemented.')
  }

  public proposalAndRequestAreEqual(
    proposalAttachments: ProofAttachmentFormat[],
    requestAttachments: ProofAttachmentFormat[]
  ): boolean {
    throw new Error('Method not implemented.')
  }

  public supportsFormat(formatIdentifier: string): boolean {
    const supportedFormats = [
      ATTACHMENT_FORMAT.V2_PRESENTATION_PROPOSAL.ldproof.format,
      ATTACHMENT_FORMAT.V2_PRESENTATION_REQUEST.ldproof.format,
      ATTACHMENT_FORMAT.V2_PRESENTATION.ldproof.format,
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
