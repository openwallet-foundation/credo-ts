import type { AnonCredsRevocationStatusList } from '../models'
import type { AnonCredsIssuerService, AnonCredsHolderService } from '../services'
import type {
  DataIntegrityCredentialRequest,
  DataIntegrityCredentialOffer,
  AnonCredsLinkSecretBindingMethod,
  DidCommSignedAttachmentBindingMethod,
  DataIntegrityCredentialRequestBindingProof,
  W3C_VC_DATA_MODEL_VERSION,
  DataIntegrityCredential,
  AnonCredsLinkSecretDataIntegrityBindingProof,
  DidCommSignedAttachmentDataIntegrityBindingProof,
  DataIntegrityOfferCredentialFormat,
  DataIntegrityCredentialFormat,
  DataIntegrityRequestMetadata,
  DataIntegrityMetadata,
  CredentialFormatService,
  AgentContext,
  CredentialFormatCreateProposalOptions,
  CredentialFormatCreateProposalReturn,
  CredentialFormatProcessOptions,
  CredentialFormatAcceptProposalOptions,
  CredentialFormatCreateOfferReturn,
  CredentialFormatCreateOfferOptions,
  CredentialFormatAcceptOfferOptions,
  CredentialFormatCreateReturn,
  CredentialFormatAcceptRequestOptions,
  CredentialFormatProcessCredentialOptions,
  CredentialFormatAutoRespondProposalOptions,
  CredentialFormatAutoRespondOfferOptions,
  CredentialFormatAutoRespondRequestOptions,
  CredentialFormatAutoRespondCredentialOptions,
  CredentialExchangeRecord,
  CredentialPreviewAttributeOptions,
  JsonObject,
  AnonCredsClaimRecord,
  JwaSignatureAlgorithm,
  JwsDetachedFormat,
  AnonCredsCredentialRecordOptions,
  DataIntegrityLinkSecretRequestMetadata,
  DataIntegrityLinkSecretMetadata,
} from '@aries-framework/core'

import {
  ProblemReportError,
  CredentialFormatSpec,
  AriesFrameworkError,
  Attachment,
  JsonEncoder,
  utils,
  CredentialProblemReportReason,
  JsonTransformer,
  W3cCredential,
  DidsApi,
  W3cCredentialService,
  W3cJsonLdVerifiableCredential,
  getJwkClassFromKeyType,
  AttachmentData,
  JwsService,
  getKeyFromVerificationMethod,
  getJwkFromKey,
  DataIntegrityRequestMetadataKey,
  DataIntegrityMetadataKey,
  ClaimFormat,
  JwtPayload,
  SignatureSuiteRegistry,
  parseDid,
} from '@aries-framework/core'
import { W3cCredential as AW3cCredential } from '@hyperledger/anoncreds-shared'

import { AnonCredsError } from '../error'
import {
  AnonCredsCredentialDefinitionRepository,
  AnonCredsLinkSecretRepository,
  AnonCredsRevocationRegistryDefinitionPrivateRepository,
  AnonCredsRevocationRegistryState,
} from '../repository'
import { AnonCredsIssuerServiceSymbol, AnonCredsHolderServiceSymbol } from '../services'
import { AnonCredsRegistryService } from '../services/registry/AnonCredsRegistryService'
import { dateToTimestamp, fetchObjectsFromLedger, fetchQualifiedIds, legacyCredentialToW3cCredential } from '../utils'
import {
  convertAttributesToCredentialValues,
  assertAttributesMatch as assertAttributesMatchSchema,
} from '../utils/credential'

const W3C_DATA_INTEGRITY_CREDENTIAL_OFFER = 'didcomm/w3c-di-vc-offer@v0.1'
const W3C_DATA_INTEGRITY_CREDENTIAL_REQUEST = 'didcomm/w3c-di-vc-request@v0.1'
const W3C_DATA_INTEGRITY_CREDENTIAL = 'didcomm/w3c-di-vc@v0.1'

export class DataIntegrityCredentialFormatService implements CredentialFormatService<DataIntegrityCredentialFormat> {
  /** formatKey is the key used when calling agent.credentials.xxx with credentialFormats.anoncreds */
  public readonly formatKey = 'dataIntegrity' as const

  /**
   * credentialRecordType is the type of record that stores the credential. It is stored in the credential
   * record binding in the credential exchange record.
   */
  public readonly credentialRecordType = 'w3c' as const

  /**
   * Create a {@link AttachmentFormats} object dependent on the message type.
   *
   * @param options The object containing all the options for the proposed credential
   * @returns object containing associated attachment, format and optionally the credential preview
   *
   */
  public async createProposal(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    agentContext: AgentContext,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    { credentialFormats, credentialRecord }: CredentialFormatCreateProposalOptions<DataIntegrityCredentialFormat>
  ): Promise<CredentialFormatCreateProposalReturn> {
    throw new AriesFrameworkError('Not defined')
  }

  public async processProposal(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    agentContext: AgentContext,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    { attachment }: CredentialFormatProcessOptions
  ): Promise<void> {
    throw new AriesFrameworkError('Not defined')
  }

  public async acceptProposal(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    agentContext: AgentContext,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    input: CredentialFormatAcceptProposalOptions<DataIntegrityCredentialFormat>
  ): Promise<CredentialFormatCreateOfferReturn> {
    throw new AriesFrameworkError('Not defined')
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
    {
      credentialFormats,
      credentialRecord,
      attachmentId,
    }: CredentialFormatCreateOfferOptions<DataIntegrityCredentialFormat>
  ): Promise<CredentialFormatCreateOfferReturn> {
    const dataIntegrityFormat = credentialFormats.dataIntegrity
    if (!dataIntegrityFormat) throw new AriesFrameworkError('Missing data integrity credential format data')

    const format = new CredentialFormatSpec({
      attachmentId: attachmentId,
      format: W3C_DATA_INTEGRITY_CREDENTIAL_OFFER,
    })

    const credential = dataIntegrityFormat.credential
    if ('proof' in credential) throw new AriesFrameworkError('Cannot offer a credential that already has a proof.')

    const { dataIntegrityCredentialOffer, previewAttributes } = await this.createDataIntegrityCredentialOffer(
      agentContext,
      credentialRecord,
      dataIntegrityFormat
    )

    const attachment = this.getFormatData(dataIntegrityCredentialOffer, format.attachmentId)
    return { format, attachment, previewAttributes }
  }

  private enhanceCredentialOffer(credential: JsonObject, version: W3C_VC_DATA_MODEL_VERSION) {
    // these modification ensure that the credential is valid
    if (!credential.issuer) credential.issuer = 'https://example.issuer.com'

    if (version === '1.1') {
      if (!credential.issuanceDate) credential.issuanceDate = new Date().toISOString()
    } else if (version === '2.0') {
      // do nothing
    } else {
      throw new AriesFrameworkError(`Unsupported data model version: ${version}`)
    }

    return credential
  }

  public async processOffer(
    agentContext: AgentContext,
    { attachment, credentialRecord }: CredentialFormatProcessOptions
  ) {
    agentContext.config.logger.debug(
      `Processing data integrity credential offer for credential record ${credentialRecord.id}`
    )

    const { credential, data_model_versions_supported, binding_method, binding_required } =
      attachment.getDataAsJson<DataIntegrityCredentialOffer>()

    // validate the credential
    const credentialToBeValidated = this.enhanceCredentialOffer(credential, data_model_versions_supported[0])
    JsonTransformer.fromJSON(credentialToBeValidated, W3cCredential)

    const missingBindingMethod =
      binding_required && !binding_method?.anoncreds_link_secret && !binding_method?.didcomm_signed_attachment

    const invalidDataModelVersions =
      !data_model_versions_supported ||
      data_model_versions_supported.length === 0 ||
      data_model_versions_supported.some((v) => v !== '1.1' && v !== '2.0')

    const invalidLinkSecretBindingMethod =
      binding_method?.anoncreds_link_secret &&
      (!binding_method.anoncreds_link_secret.cred_def_id ||
        !binding_method.anoncreds_link_secret.key_correctness_proof ||
        !binding_method.anoncreds_link_secret.nonce)

    const invalidDidCommSignedAttachmentBindingMethod =
      binding_method?.didcomm_signed_attachment &&
      (!binding_method.didcomm_signed_attachment.algs_supported ||
        !binding_method.didcomm_signed_attachment.did_methods_supported ||
        !binding_method.didcomm_signed_attachment.nonce)

    if (
      missingBindingMethod ||
      invalidDataModelVersions ||
      invalidLinkSecretBindingMethod ||
      invalidDidCommSignedAttachmentBindingMethod
    ) {
      throw new ProblemReportError('Invalid credential offer', {
        problemCode: CredentialProblemReportReason.IssuanceAbandoned,
      })
    }
  }

  private async createSignedAttachment(
    agentContext: AgentContext,
    data: { aud: string; nonce: string },
    options: { alg?: string; kid: string },
    issuerSupportedAlgs: string[]
  ) {
    const { alg, kid } = options

    if (!kid.startsWith('did:')) {
      throw new AriesFrameworkError(`kid '${kid}' is not a DID. Only dids are supported for kid`)
    } else if (!kid.includes('#')) {
      throw new AriesFrameworkError(
        `kid '${kid}' does not contain a fragment. kid MUST point to a specific key in the did document.`
      )
    }

    const didsApi = agentContext.dependencyManager.resolve(DidsApi)
    const didDocument = await didsApi.resolveDidDocument(kid)
    const verificationMethod = didDocument.dereferenceKey(kid)
    const key = getKeyFromVerificationMethod(verificationMethod)
    const jwk = getJwkFromKey(key)

    if (alg && !jwk.supportsSignatureAlgorithm(alg)) {
      throw new AriesFrameworkError(`key type '${jwk.keyType}', does not support the JWS signature alg '${alg}'`)
    }

    const signingAlg = issuerSupportedAlgs.find(
      (supportedAlg) => jwk.supportsSignatureAlgorithm(supportedAlg) && (alg === undefined || alg === supportedAlg)
    )
    if (!signingAlg) throw new AriesFrameworkError('No signing algorithm supported by the issuer found')

    const jwsService = agentContext.dependencyManager.resolve(JwsService)
    const jws = await jwsService.createJws(agentContext, {
      key,
      header: {},
      payload: new JwtPayload({ aud: data.aud, additionalClaims: { nonce: data.nonce } }),
      protectedHeaderOptions: { alg: signingAlg, kid },
    })

    const signedAttach = new Attachment({
      mimeType: typeof data === 'string' ? undefined : 'application/json',
      data: new AttachmentData({ base64: jws.payload }),
    })

    signedAttach.addJws(jws)

    return signedAttach
  }

  private async getSignedAttachmentPayload(agentContext: AgentContext, signedAttachment: Attachment) {
    const jws = signedAttachment.data.jws as JwsDetachedFormat
    if (!jws) throw new AriesFrameworkError('Missing jws in signed attachment')
    if (!jws.protected) throw new AriesFrameworkError('Missing protected header in signed attachment')
    if (!signedAttachment.data.base64) throw new AriesFrameworkError('Missing payload in signed attachment')

    const jwsService = agentContext.dependencyManager.resolve(JwsService)
    const { isValid } = await jwsService.verifyJws(agentContext, {
      jws: {
        header: jws.header,
        protected: jws.protected,
        signature: jws.signature,
        payload: signedAttachment.data.base64,
      },
      jwkResolver: async ({ protectedHeader: { kid } }) => {
        if (!kid || typeof kid !== 'string') throw new AriesFrameworkError('Missing kid in protected header.')
        if (!kid.startsWith('did:')) throw new AriesFrameworkError('Only did is supported for kid identifier')

        const didsApi = agentContext.dependencyManager.resolve(DidsApi)
        const didDocument = await didsApi.resolveDidDocument(kid)
        const verificationMethod = didDocument.dereferenceKey(kid)
        const key = getKeyFromVerificationMethod(verificationMethod)
        return getJwkFromKey(key)
      },
    })

    if (!isValid) throw new AriesFrameworkError('Failed to validate signature of signed attachment')
    const payload = JsonEncoder.fromBase64(signedAttachment.data.base64) as { aud: string; nonce: string }
    if (!payload.aud || !payload.nonce) throw new AriesFrameworkError('Invalid payload in signed attachment')

    return payload
  }

  public async acceptOffer(
    agentContext: AgentContext,
    {
      credentialRecord,
      attachmentId,
      offerAttachment,
      credentialFormats,
    }: CredentialFormatAcceptOfferOptions<DataIntegrityCredentialFormat>
  ): Promise<CredentialFormatCreateReturn> {
    const dataIntegrityFormat = credentialFormats?.dataIntegrity
    if (!dataIntegrityFormat) throw new AriesFrameworkError('Missing data integrity credential format data')

    const credentialOffer = offerAttachment.getDataAsJson<DataIntegrityCredentialOffer>()

    const dataIntegrityMetadata: DataIntegrityMetadata = {}
    const dataIntegrityRequestMetadata: DataIntegrityRequestMetadata = {}

    let anonCredsLinkSecretDataIntegrityBindingProof: AnonCredsLinkSecretDataIntegrityBindingProof | undefined =
      undefined
    if (dataIntegrityFormat.anonCredsLinkSecretCredentialRequestOptions) {
      if (!credentialOffer.binding_method?.anoncreds_link_secret) {
        throw new AriesFrameworkError('Cannot request credential with a binding method that was not offered.')
      }

      const anonCredsHolderService =
        agentContext.dependencyManager.resolve<AnonCredsHolderService>(AnonCredsHolderServiceSymbol)

      const credentialDefinitionId = credentialOffer.binding_method.anoncreds_link_secret.cred_def_id
      const { credentialDefinitionReturn } = await fetchObjectsFromLedger(agentContext, { credentialDefinitionId })
      if (!credentialDefinitionReturn.credentialDefinition) {
        throw new AnonCredsError(`Unable to retrieve credential definition with id ${credentialDefinitionId}`)
      }

      const {
        credentialRequest: anonCredsCredentialRequest,
        credentialRequestMetadata: anonCredsCredentialRequestMetadata,
      } = await anonCredsHolderService.createCredentialRequest(agentContext, {
        credentialOffer: {
          ...credentialOffer.binding_method.anoncreds_link_secret,
          schema_id: credentialDefinitionReturn.credentialDefinition.schemaId,
        },
        credentialDefinition: credentialDefinitionReturn.credentialDefinition,
        linkSecretId: dataIntegrityFormat.anonCredsLinkSecretCredentialRequestOptions?.linkSecretId,
      })

      dataIntegrityRequestMetadata.linkSecretRequestMetadata = anonCredsCredentialRequestMetadata

      dataIntegrityMetadata.linkSecretMetadata = {
        credentialDefinitionId: credentialOffer.binding_method.anoncreds_link_secret.cred_def_id,
        schemaId: credentialDefinitionReturn.credentialDefinition.schemaId,
      }

      if (!anonCredsCredentialRequest.entropy) {
        throw new AriesFrameworkError('Missing entropy for anonCredsCredentialRequest')
      }
      anonCredsLinkSecretDataIntegrityBindingProof =
        anonCredsCredentialRequest as AnonCredsLinkSecretDataIntegrityBindingProof
    }

    let didCommSignedAttachmentBindingProof: DidCommSignedAttachmentDataIntegrityBindingProof | undefined = undefined
    let didCommSignedAttachment: Attachment | undefined = undefined
    if (dataIntegrityFormat.didCommSignedAttachmentCredentialRequestOptions) {
      if (!credentialOffer.binding_method?.didcomm_signed_attachment) {
        throw new AriesFrameworkError('Cannot request credential with a binding method that was not offered.')
      }

      const offeredCredential = credentialOffer.credential

      let aud: string
      if (offeredCredential?.issuer) {
        if (typeof offeredCredential.issuer === 'string') aud = offeredCredential.issuer
        else if (Array.isArray(offeredCredential.issuer)) throw new AriesFrameworkError('Issuer cannot be an array')
        else if (typeof offeredCredential.issuer === 'object' && typeof offeredCredential.issuer.id === 'string')
          aud = offeredCredential.issuer.id
        else {
          throw new AriesFrameworkError('Wrong issuer format in credential offer')
        }
      } else {
        // TODO: If the issuer is not included in the credential in the offer, the aud MUST be the same as the did of the recipient did of the DIDComm message containing the request message.
        throw new AriesFrameworkError('Wrong issuer format in credential offer')
      }

      const holderDidMethod = parseDid(aud).method
      if (!credentialOffer.binding_method.didcomm_signed_attachment.did_methods_supported.includes(holderDidMethod)) {
        throw new AriesFrameworkError(`Holder did method ${holderDidMethod} not supported by the issuer`)
      }

      didCommSignedAttachment = await this.createSignedAttachment(
        agentContext,
        { aud, nonce: credentialOffer.binding_method.didcomm_signed_attachment.nonce },
        dataIntegrityFormat.didCommSignedAttachmentCredentialRequestOptions,
        credentialOffer.binding_method.didcomm_signed_attachment.algs_supported
      )

      didCommSignedAttachmentBindingProof = { attachment_id: didCommSignedAttachment.id }
    }

    const bindingProof: DataIntegrityCredentialRequestBindingProof | undefined =
      !anonCredsLinkSecretDataIntegrityBindingProof && !didCommSignedAttachmentBindingProof
        ? undefined
        : {
            anoncreds_link_secret: anonCredsLinkSecretDataIntegrityBindingProof,
            didcomm_signed_attachment: didCommSignedAttachmentBindingProof,
          }

    if (credentialOffer.binding_required && !bindingProof) {
      throw new AriesFrameworkError('Missing required binding proof')
    }

    const dataModelVersion = dataIntegrityFormat.dataModelVersion ?? credentialOffer.data_model_versions_supported[0]
    if (!credentialOffer.data_model_versions_supported.includes(dataModelVersion)) {
      throw new AriesFrameworkError('Cannot request credential with a data model version that was not offered.')
    }

    credentialRecord.metadata.set<DataIntegrityMetadata>(DataIntegrityMetadataKey, dataIntegrityMetadata)
    credentialRecord.metadata.set<DataIntegrityRequestMetadata>(
      DataIntegrityRequestMetadataKey,
      dataIntegrityRequestMetadata
    )

    const credentialRequest: DataIntegrityCredentialRequest = {
      data_model_version: dataModelVersion,
      binding_proof: bindingProof,
    }

    const format = new CredentialFormatSpec({
      attachmentId,
      format: W3C_DATA_INTEGRITY_CREDENTIAL_REQUEST,
    })

    const attachment = this.getFormatData(credentialRequest, format.attachmentId)
    return { format, attachment, appendAttachments: didCommSignedAttachment ? [didCommSignedAttachment] : undefined }
  }

  /**
   * Starting from a request is not supported for anoncreds credentials, this method only throws an error.
   */
  public async createRequest(): Promise<CredentialFormatCreateReturn> {
    throw new AriesFrameworkError('Starting from a request is not supported for w3c credentials')
  }

  /**
   * We don't have any models to validate an anoncreds request object, for now this method does nothing
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async processRequest(agentContext: AgentContext, options: CredentialFormatProcessOptions): Promise<void> {
    // not needed for dataIntegrity
    // TODO: implement
  }

  private async createCredentialWithAnonCredsDataIntegrityProof(
    agentContext: AgentContext,
    input: {
      credentialRecord: CredentialExchangeRecord
      anonCredsLinkSecretBindingMethod: AnonCredsLinkSecretBindingMethod
      anonCredsLinkSecretBindingProof: AnonCredsLinkSecretDataIntegrityBindingProof
      linkSecretMetadata: DataIntegrityLinkSecretMetadata
    }
  ): Promise<W3cJsonLdVerifiableCredential> {
    const { credentialRecord, anonCredsLinkSecretBindingMethod, anonCredsLinkSecretBindingProof, linkSecretMetadata } =
      input

    const credentialAttributes = credentialRecord.credentialAttributes
    if (!credentialAttributes) {
      throw new AriesFrameworkError(
        `Missing required credential attribute values on credential record with id ${credentialRecord.id}`
      )
    }

    const anonCredsIssuerService =
      agentContext.dependencyManager.resolve<AnonCredsIssuerService>(AnonCredsIssuerServiceSymbol)

    const credentialDefinition = (
      await agentContext.dependencyManager
        .resolve(AnonCredsCredentialDefinitionRepository)
        .getByCredentialDefinitionId(agentContext, linkSecretMetadata.credentialDefinitionId)
    ).credentialDefinition.value

    // We check locally for credential definition info. If it supports revocation, we need to search locally for
    // an active revocation registry
    let revocationRegistryDefinitionId: string | undefined = undefined
    let revocationRegistryIndex: number | undefined = undefined
    let revocationStatusList: AnonCredsRevocationStatusList | undefined = undefined

    if (credentialDefinition.revocation) {
      const { credentialRevocationId, revocationRegistryId } = linkSecretMetadata

      if (!credentialRevocationId || !revocationRegistryId) {
        throw new AriesFrameworkError(
          'Revocation registry definition id and revocation index are mandatory to issue AnonCreds revocable credentials'
        )
      }

      revocationRegistryDefinitionId = revocationRegistryId
      revocationRegistryIndex = Number(credentialRevocationId)

      const revocationRegistryDefinitionPrivateRecord = await agentContext.dependencyManager
        .resolve(AnonCredsRevocationRegistryDefinitionPrivateRepository)
        .getByRevocationRegistryDefinitionId(agentContext, revocationRegistryDefinitionId)

      if (revocationRegistryDefinitionPrivateRecord.state !== AnonCredsRevocationRegistryState.Active) {
        throw new AriesFrameworkError(
          `Revocation registry ${revocationRegistryDefinitionId} is in ${revocationRegistryDefinitionPrivateRecord.state} state`
        )
      }

      const registryService = agentContext.dependencyManager.resolve(AnonCredsRegistryService)
      const revocationStatusListResult = await registryService
        .getRegistryForIdentifier(agentContext, revocationRegistryDefinitionId)
        .getRevocationStatusList(agentContext, revocationRegistryDefinitionId, dateToTimestamp(new Date()))

      if (!revocationStatusListResult.revocationStatusList) {
        throw new AriesFrameworkError(
          `Unable to resolve revocation status list for ${revocationRegistryDefinitionId}:
          ${revocationStatusListResult.resolutionMetadata.error} ${revocationStatusListResult.resolutionMetadata.message}`
        )
      }

      revocationStatusList = revocationStatusListResult.revocationStatusList
    }

    // TODO: bad abd bad
    const { credential } = await anonCredsIssuerService.createCredential(agentContext, {
      credentialOffer: {
        ...anonCredsLinkSecretBindingMethod,
        schema_id: linkSecretMetadata.schemaId,
      },
      credentialRequest: anonCredsLinkSecretBindingProof,
      credentialValues: convertAttributesToCredentialValues(credentialAttributes),
      revocationRegistryDefinitionId,
      revocationRegistryIndex,
      revocationStatusList,
    })

    return await legacyCredentialToW3cCredential(agentContext, credential)
  }

  public async acceptRequest(
    agentContext: AgentContext,
    {
      credentialFormats,
      credentialRecord,
      attachmentId,
      offerAttachment,
      requestAttachment,
      requestAppendAttachments,
    }: CredentialFormatAcceptRequestOptions<DataIntegrityCredentialFormat>
  ): Promise<CredentialFormatCreateReturn> {
    // Assert credential attributes
    const credentialAttributes = credentialRecord.credentialAttributes
    if (!credentialAttributes) {
      throw new AriesFrameworkError(
        `Missing required credential attribute values on credential record with id ${credentialRecord.id}`
      )
    }

    const dataIntegrityFormat = credentialFormats?.dataIntegrity
    if (!dataIntegrityFormat) throw new AriesFrameworkError('Missing data integrity credential format data')

    const credentialOffer = offerAttachment?.getDataAsJson<DataIntegrityCredentialOffer>()
    if (!credentialOffer) throw new AriesFrameworkError('Missing data integrity credential offer in createCredential')

    const credentialRequest = requestAttachment.getDataAsJson<DataIntegrityCredentialRequest>()
    if (!credentialRequest)
      throw new AriesFrameworkError('Missing data integrity credential request in createCredential')

    const dataIntegrityMetadata = credentialRecord.metadata.get<DataIntegrityMetadata>(DataIntegrityMetadataKey)
    if (!dataIntegrityMetadata)
      throw new AriesFrameworkError('Missing data integrity credential metadata in createCredential')

    let credential: W3cJsonLdVerifiableCredential | undefined
    if (credentialRequest.binding_proof?.anoncreds_link_secret) {
      if (!credentialOffer.binding_method?.anoncreds_link_secret) {
        throw new AriesFrameworkError('Cannot issue credential with a binding method that was not offered.')
      }

      if (!dataIntegrityMetadata.linkSecretMetadata) {
        throw new AriesFrameworkError('Missing anoncreds link secret metadata')
      }

      credential = await this.createCredentialWithAnonCredsDataIntegrityProof(agentContext, {
        credentialRecord,
        anonCredsLinkSecretBindingMethod: credentialOffer.binding_method.anoncreds_link_secret,
        linkSecretMetadata: dataIntegrityMetadata.linkSecretMetadata,
        anonCredsLinkSecretBindingProof: credentialRequest.binding_proof.anoncreds_link_secret,
      })
    }

    if (credentialRequest.binding_proof?.didcomm_signed_attachment) {
      if (!credentialOffer.binding_method?.didcomm_signed_attachment) {
        throw new AriesFrameworkError('Cannot issue credential with a binding method that was not offered.')
      }

      const bindingProofAttachment = requestAppendAttachments?.find(
        (attachments) => attachments.id === credentialRequest.binding_proof?.didcomm_signed_attachment?.attachment_id
      )
      if (!bindingProofAttachment) throw new AriesFrameworkError('Missing binding proof attachment')

      const issuerKid = dataIntegrityFormat.didCommSignedAttachmentAcceptRequestOptions?.kid
      if (!issuerKid) throw new AriesFrameworkError('Missing kid')

      // very bad
      const offeredCredential = JsonTransformer.fromJSON(credentialOffer.credential, W3cCredential)

      const { aud, nonce } = await this.getSignedAttachmentPayload(agentContext, bindingProofAttachment)
      if (nonce !== credentialOffer.binding_method.didcomm_signed_attachment.nonce) {
        throw new AriesFrameworkError('Invalid nonce in signed attachment')
      }

      const issuer =
        typeof offeredCredential.issuer === 'string' ? offeredCredential.issuer : offeredCredential.issuer.id
      if (issuer !== aud) throw new AriesFrameworkError('Invalid aud in signed attachment')

      const didsApi = agentContext.dependencyManager.resolve(DidsApi)
      const didDocument = await didsApi.resolveDidDocument(issuer)
      const verificationMethod = didDocument.dereferenceVerificationMethod(issuerKid)

      const signatureSuiteRegistry = agentContext.dependencyManager.resolve(SignatureSuiteRegistry)
      const signatureSuite = signatureSuiteRegistry.getByVerificationMethodType(verificationMethod.type)
      if (!signatureSuite) {
        throw new AriesFrameworkError(
          `Could not find signature suite for verification method type ${verificationMethod.type}`
        )
      }

      if (credential) {
        //TODO: in this case we already have a credential, so we can use that and just add another signature
        throw new AriesFrameworkError('TODO: implement and remove this!')
      } else {
        const w3cCredentialService = agentContext.dependencyManager.resolve(W3cCredentialService)
        credential = (await w3cCredentialService.signCredential(agentContext, {
          format: ClaimFormat.LdpVc,
          credential: offeredCredential,
          proofType: signatureSuite.proofType,
          verificationMethod: verificationMethod.id,
        })) as W3cJsonLdVerifiableCredential
      }
    }

    if (
      !credentialRequest.binding_proof?.anoncreds_link_secret &&
      !credentialRequest.binding_proof?.didcomm_signed_attachment
    ) {
      // TODO: sign with an arbitrary cryptosuite, but cannot be anoncreds ....
      throw new AriesFrameworkError('Not impelmented')
    }

    const format = new CredentialFormatSpec({
      attachmentId,
      format: W3C_DATA_INTEGRITY_CREDENTIAL,
    })

    const attachment = this.getFormatData({ credential: JsonTransformer.toJSON(credential) }, format.attachmentId)
    return { format, attachment }
  }

  private async processLinkSecretBoundCredential(
    agentContext: AgentContext,
    credentialJson: JsonObject,
    credentialRecord: CredentialExchangeRecord,
    linkSecretRequestMetadata: DataIntegrityLinkSecretRequestMetadata
  ) {
    if (!credentialRecord.credentialAttributes) {
      throw new AriesFrameworkError(
        'Missing credential attributes on credential record. Unable to check credential attributes'
      )
    }

    const aCredential = AW3cCredential.fromJson(credentialJson)
    const { schemaId, credentialDefinitionId, revocationRegistryId, revocationRegistryIndex } = aCredential.toLegacy()

    const { schemaReturn, credentialDefinitionReturn, revocationRegistryDefinitionReturn } =
      await fetchObjectsFromLedger(agentContext, {
        schemaId,
        credentialDefinitionId,
        revocationRegistryId: revocationRegistryId as string | undefined,
      })
    if (!schemaReturn.schema) throw new AriesFrameworkError('Schema not found.')
    if (!credentialDefinitionReturn.credentialDefinition) {
      throw new AriesFrameworkError('Credential definition not found.')
    }

    if (revocationRegistryId && !revocationRegistryDefinitionReturn?.revocationRegistryDefinition) {
      throw new AriesFrameworkError('Revoaction Registry definition not found.')
    }

    const methodName = agentContext.dependencyManager
      .resolve(AnonCredsRegistryService)
      .getRegistryForIdentifier(agentContext, credentialDefinitionReturn.credentialDefinitionId).methodName

    const linkSecretRecord = await agentContext.dependencyManager
      .resolve(AnonCredsLinkSecretRepository)
      .getByLinkSecretId(agentContext, linkSecretRequestMetadata.link_secret_name)

    if (!linkSecretRecord.value) throw new AriesFrameworkError('Link Secret value not stored')

    const processed = aCredential.process({
      credentialRequestMetadata: linkSecretRequestMetadata as unknown as JsonObject,
      credentialDefinition: credentialDefinitionReturn.credentialDefinition as unknown as JsonObject,
      linkSecret: linkSecretRecord.value,
      revocationRegistryDefinition:
        revocationRegistryDefinitionReturn?.revocationRegistryDefinition as unknown as JsonObject,
    })

    const anonCredsCredentialRecordOptions = {
      credentialId: utils.uuid(),
      linkSecretId: linkSecretRecord.linkSecretId,
      credentialDefinitionId: credentialDefinitionReturn.credentialDefinitionId,
      schemaId: schemaReturn.schemaId,
      schemaName: schemaReturn.schema.name,
      schemaIssuerId: schemaReturn.schema.issuerId,
      schemaVersion: schemaReturn.schema.version,
      methodName,
      revocationRegistryId: revocationRegistryDefinitionReturn?.revocationRegistryDefinitionId,
      credentialRevocationId: revocationRegistryIndex?.toString(),
    }

    // If the credential is revocable, store the revocation identifiers in the credential record
    if (revocationRegistryId) {
      const metadata = credentialRecord.metadata.get<DataIntegrityMetadata>(DataIntegrityMetadataKey)
      if (!metadata?.linkSecretMetadata) throw new AriesFrameworkError('Missing link secret metadata')

      metadata.linkSecretMetadata.revocationRegistryId =
        revocationRegistryDefinitionReturn?.revocationRegistryDefinitionId
      metadata.linkSecretMetadata.credentialRevocationId = revocationRegistryIndex?.toString()
      credentialRecord.metadata.set<DataIntegrityMetadata>(DataIntegrityMetadataKey, metadata)
    }

    return { processed: processed.toJson(), anonCredsCredentialRecordOptions }
  }

  /**
   * Processes an incoming credential - retrieve metadata, retrieve payload and store it in wallet
   * @param options the issue credential message wrapped inside this object
   * @param credentialRecord the credential exchange record for this credential
   */
  public async processCredential(
    agentContext: AgentContext,
    { credentialRecord, attachment, requestAttachment }: CredentialFormatProcessCredentialOptions
  ): Promise<void> {
    const credentialRequestMetadata = credentialRecord.metadata.get<DataIntegrityRequestMetadata>(
      DataIntegrityRequestMetadataKey
    )
    if (!credentialRequestMetadata) {
      throw new AriesFrameworkError(
        `Missing request metadata for credential exchange with thread id ${credentialRecord.id}`
      )
    }

    const credentialRequest = requestAttachment.getDataAsJson<DataIntegrityCredentialRequest>()
    if (!credentialRequest)
      throw new AriesFrameworkError('Missing data integrity credential request in createCredential')

    if (!credentialRecord.credentialAttributes) {
      throw new AriesFrameworkError('Missing credential attributes on credential record.')
    }

    // TODO: validate credential structure
    const { credential: credentialJson } = attachment.getDataAsJson<DataIntegrityCredential>()

    let anonCredsCredentialRecordOptions: AnonCredsCredentialRecordOptions | undefined
    let w3cJsonLdVerifiableCredential: W3cJsonLdVerifiableCredential
    if (credentialRequest.binding_proof?.anoncreds_link_secret) {
      if (!credentialRequestMetadata.linkSecretRequestMetadata) {
        throw new AriesFrameworkError('Missing link secret request metadata')
      }

      const { anonCredsCredentialRecordOptions: options, processed } = await this.processLinkSecretBoundCredential(
        agentContext,
        credentialJson,
        credentialRecord,
        credentialRequestMetadata.linkSecretRequestMetadata
      )
      anonCredsCredentialRecordOptions = options

      w3cJsonLdVerifiableCredential = JsonTransformer.fromJSON(processed, W3cJsonLdVerifiableCredential)
      await this.assertCredentialAttributesMatchSchemaAttributes(
        agentContext,
        w3cJsonLdVerifiableCredential,
        anonCredsCredentialRecordOptions.schemaId
      )
    } else {
      w3cJsonLdVerifiableCredential = JsonTransformer.fromJSON(credentialJson, W3cJsonLdVerifiableCredential)
    }

    const w3cCredentialService = agentContext.dependencyManager.resolve(W3cCredentialService)
    const record = await w3cCredentialService.storeCredential(agentContext, {
      credential: w3cJsonLdVerifiableCredential,
      anonCredsCredentialRecordOptions,
    })

    credentialRecord.credentials.push({
      credentialRecordType: this.credentialRecordType,
      credentialRecordId: record.id,
    })
  }

  public supportsFormat(format: string): boolean {
    const supportedFormats = [
      W3C_DATA_INTEGRITY_CREDENTIAL_REQUEST,
      W3C_DATA_INTEGRITY_CREDENTIAL_OFFER,
      W3C_DATA_INTEGRITY_CREDENTIAL,
    ]

    return supportedFormats.includes(format)
  }

  /**
   * Gets the attachment object for a given attachmentId. We need to get out the correct attachmentId for
   * anoncreds and then find the corresponding attachment (if there is one)
   * @param formats the formats object containing the attachmentId
   * @param messageAttachments the attachments containing the payload
   * @returns The Attachment if found or undefined
   *
   */
  public getAttachment(formats: CredentialFormatSpec[], messageAttachments: Attachment[]): Attachment | undefined {
    const supportedAttachmentIds = formats.filter((f) => this.supportsFormat(f.format)).map((f) => f.attachmentId)
    const supportedAttachment = messageAttachments.find((attachment) => supportedAttachmentIds.includes(attachment.id))

    return supportedAttachment
  }

  public async deleteCredentialById(agentContext: AgentContext, credentialRecordId: string): Promise<void> {
    const anonCredsHolderService =
      agentContext.dependencyManager.resolve<AnonCredsHolderService>(AnonCredsHolderServiceSymbol)

    await anonCredsHolderService.deleteCredential(agentContext, credentialRecordId)
  }

  public async shouldAutoRespondToProposal(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    agentContext: AgentContext,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    { offerAttachment, proposalAttachment }: CredentialFormatAutoRespondProposalOptions
  ) {
    throw new AriesFrameworkError('Not implemented')
    return false
  }

  public async shouldAutoRespondToOffer(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    agentContext: AgentContext,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    input: CredentialFormatAutoRespondOfferOptions
  ) {
    return false
  }

  public async shouldAutoRespondToRequest(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    agentContext: AgentContext,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    { offerAttachment, requestAttachment }: CredentialFormatAutoRespondRequestOptions
  ) {
    return false
  }

  public async shouldAutoRespondToCredential(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    agentContext: AgentContext,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    { credentialRecord, requestAttachment, credentialAttachment }: CredentialFormatAutoRespondCredentialOptions
  ) {
    return false
  }

  private async createDataIntegrityCredentialOffer(
    agentContext: AgentContext,
    credentialRecord: CredentialExchangeRecord,
    options: DataIntegrityOfferCredentialFormat
  ): Promise<{
    dataIntegrityCredentialOffer: DataIntegrityCredentialOffer
    previewAttributes: CredentialPreviewAttributeOptions[]
  }> {
    const {
      bindingRequired,
      credential,
      anonCredsLinkSecretBindingMethodOptions,
      didCommSignedAttachmentBindingMethodOptions,
    } = options

    const dataModelVersionsSupported: W3C_VC_DATA_MODEL_VERSION[] = ['1.1']

    // validate the credential and get the preview attributes
    const credentialJson = credential instanceof W3cCredential ? JsonTransformer.toJSON(credential) : credential
    const validCredential = this.enhanceCredentialOffer(credentialJson, dataModelVersionsSupported[0])
    const validW3cCredential = JsonTransformer.fromJSON(validCredential, W3cCredential)
    const previewAttributes = this.previewAttributesFromCredential(validW3cCredential)

    const dataIntegrityMetadata: DataIntegrityMetadata = {}

    let anonCredsLinkSecretBindingMethod: AnonCredsLinkSecretBindingMethod | undefined = undefined
    if (anonCredsLinkSecretBindingMethodOptions) {
      const { credentialDefinitionId, revocationRegistryDefinitionId, revocationRegistryIndex } =
        anonCredsLinkSecretBindingMethodOptions

      const anoncredsCredentialOffer = await agentContext.dependencyManager
        .resolve<AnonCredsIssuerService>(AnonCredsIssuerServiceSymbol)
        .createCredentialOffer(agentContext, {
          credentialDefinitionId,
        })

      // We check locally for credential definition info. If it supports revocation, revocationRegistryIndex
      // and revocationRegistryDefinitionId are mandatory
      const { credentialDefinition } = await agentContext.dependencyManager
        .resolve(AnonCredsCredentialDefinitionRepository)
        .getByCredentialDefinitionId(agentContext, anoncredsCredentialOffer.cred_def_id)

      if (credentialDefinition.value.revocation) {
        if (!revocationRegistryDefinitionId || !revocationRegistryIndex) {
          throw new AriesFrameworkError(
            'AnonCreds revocable credentials require revocationRegistryDefinitionId and revocationRegistryIndex'
          )
        }

        // Set revocation tags
        credentialRecord.setTags({
          anonCredsRevocationRegistryId: revocationRegistryDefinitionId,
          anonCredsCredentialRevocationId: revocationRegistryIndex.toString(),
        })
      }

      await this.assertCredentialAttributesMatchSchemaAttributes(
        agentContext,
        validW3cCredential,
        credentialDefinition.schemaId
      )

      const { schema_id, ..._anonCredsLinkSecretBindingMethod } = anoncredsCredentialOffer
      anonCredsLinkSecretBindingMethod = _anonCredsLinkSecretBindingMethod

      dataIntegrityMetadata.linkSecretMetadata = {
        schemaId: schema_id,
        credentialDefinitionId: credentialDefinitionId,
        credentialRevocationId: revocationRegistryIndex?.toString(),
        revocationRegistryId: revocationRegistryDefinitionId,
      }
    }

    let didCommSignedAttachmentBindingMethod: DidCommSignedAttachmentBindingMethod | undefined = undefined
    if (didCommSignedAttachmentBindingMethodOptions) {
      const { didMethodsSupported, algsSupported } = didCommSignedAttachmentBindingMethodOptions
      didCommSignedAttachmentBindingMethod = {
        did_methods_supported: didMethodsSupported ?? this.getSupportedDidMethods(agentContext),
        algs_supported: algsSupported ?? this.getSupportedJwaSignatureAlgorithms(agentContext),
        nonce: await agentContext.wallet.generateNonce(),
      }

      if (didCommSignedAttachmentBindingMethod.algs_supported.length === 0) {
        throw new AriesFrameworkError('No supported JWA signature algorithms found.')
      }

      // TODO: this can be empty according to spec
      if (didCommSignedAttachmentBindingMethod.did_methods_supported.length === 0) {
        throw new AriesFrameworkError('No supported DID methods found.')
      }
    }

    if (bindingRequired && !anonCredsLinkSecretBindingMethod && !didCommSignedAttachmentBindingMethod) {
      throw new AriesFrameworkError('Missing required binding method.')
    }

    const dataIntegrityCredentialOffer: DataIntegrityCredentialOffer = {
      data_model_versions_supported: dataModelVersionsSupported,
      binding_required: bindingRequired,
      binding_method: {
        anoncreds_link_secret: anonCredsLinkSecretBindingMethod,
        didcomm_signed_attachment: didCommSignedAttachmentBindingMethod,
      },
      credential: credentialJson,
    }

    credentialRecord.metadata.set<DataIntegrityMetadata>(DataIntegrityMetadataKey, dataIntegrityMetadata)

    return { dataIntegrityCredentialOffer, previewAttributes }
  }

  private previewAttributesFromCredential(credential: W3cCredential): CredentialPreviewAttributeOptions[] {
    if (Array.isArray(credential.credentialSubject)) {
      throw new AriesFrameworkError('Credential subject must be an object.')
    }

    const claims = {
      ...credential.credentialSubject.claims,
      ...(credential.credentialSubject.id && { id: credential.credentialSubject.id }),
    } as AnonCredsClaimRecord
    const attributes = Object.entries(claims).map(([key, value]): CredentialPreviewAttributeOptions => {
      return { name: key, value: value.toString() }
    })
    return attributes
  }

  private async assertCredentialAttributesMatchSchemaAttributes(
    agentContext: AgentContext,
    credential: W3cCredential,
    schemaId: string
  ) {
    const attributes = this.previewAttributesFromCredential(credential)

    const { schemaReturn } = await fetchObjectsFromLedger(agentContext, { schemaId })
    if (!schemaReturn.schema) {
      throw new AriesFrameworkError(
        `Unable to resolve schema ${schemaId} from registry: ${schemaReturn.resolutionMetadata.error} ${schemaReturn.resolutionMetadata.message}`
      )
    }

    assertAttributesMatchSchema(schemaReturn.schema, attributes)

    return { attributes }
  }

  /**
   * Returns an object of type {@link Attachment} for use in credential exchange messages.
   * It looks up the correct format identifier and encodes the data as a base64 attachment.
   *
   * @param data The data to include in the attach object
   * @param id the attach id from the formats component of the message
   */
  public getFormatData(data: unknown, id: string): Attachment {
    const attachment = new Attachment({
      id,
      mimeType: 'application/json',
      data: {
        base64: JsonEncoder.toBase64(data),
      },
    })

    return attachment
  }

  private getSupportedDidMethods(agentContext: AgentContext) {
    const didsApi = agentContext.dependencyManager.resolve(DidsApi)
    const supportedDidMethods: Set<string> = new Set()

    for (const resolver of didsApi.config.resolvers) {
      resolver.supportedMethods.forEach((method) => supportedDidMethods.add(method))
    }

    return Array.from(supportedDidMethods)
  }

  /**
   * Returns the JWA Signature Algorithms that are supported by the wallet.
   *
   * This is an approximation based on the supported key types of the wallet.
   * This is not 100% correct as a supporting a key type does not mean you support
   * all the algorithms for that key type. However, this needs refactoring of the wallet
   * that is planned for the 0.5.0 release.
   */
  private getSupportedJwaSignatureAlgorithms(agentContext: AgentContext): JwaSignatureAlgorithm[] {
    const supportedKeyTypes = agentContext.wallet.supportedKeyTypes

    // Extract the supported JWS algs based on the key types the wallet support.
    const supportedJwaSignatureAlgorithms = supportedKeyTypes
      // Map the supported key types to the supported JWK class
      .map(getJwkClassFromKeyType)
      // Filter out the undefined values
      .filter((jwkClass): jwkClass is Exclude<typeof jwkClass, undefined> => jwkClass !== undefined)
      // Extract the supported JWA signature algorithms from the JWK class
      .flatMap((jwkClass) => jwkClass.supportedSignatureAlgorithms)

    return supportedJwaSignatureAlgorithms
  }
}
