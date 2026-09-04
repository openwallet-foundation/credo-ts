import {
  type AgentContext,
  ClaimFormat,
  CredoError,
  DidsApi,
  deepEquality,
  getPublicJwkFromVerificationMethod,
  JsonEncoder,
  type JsonObject,
  JsonTransformer,
  type JwsDetachedFormat,
  JwsService,
  JwtPayload,
  Kms,
  parseDid,
  SignatureSuiteRegistry,
  TypedArrayEncoder,
  type VerificationMethod,
  W3cCredential,
  W3cCredentialRecord,
  W3cCredentialService,
  W3cCredentialSubject,
  W3cJsonLdVerifiableCredential,
  W3cV2Credential,
  W3cV2CredentialRecord,
  W3cV2CredentialService,
  W3cV2DataIntegrityVerifiableCredential,
} from '@credo-ts/core'
import { DidCommAttachment, DidCommAttachmentData } from '../../../../decorators/attachment/DidCommAttachment'
import { DidCommProblemReportError } from '../../../../errors/problem-reports/DidCommProblemReportError'
import { DidCommCredentialFormatSpec } from '../../models/DidCommCredentialFormatSpec'
import type { DidCommCredentialPreviewAttributeOptions } from '../../models/DidCommCredentialPreviewAttribute'
import { DidCommCredentialProblemReportReason } from '../../models/DidCommCredentialProblemReportReason'
import type { DidCommCredentialExchangeRecord } from '../../repository/DidCommCredentialExchangeRecord'
import type { DidCommCredentialFormatService } from '../DidCommCredentialFormatService'
import type {
  DidCommCredentialFormatAcceptOfferOptions,
  DidCommCredentialFormatAcceptProposalOptions,
  DidCommCredentialFormatAcceptRequestOptions,
  DidCommCredentialFormatAutoRespondCredentialOptions,
  DidCommCredentialFormatAutoRespondOfferOptions,
  DidCommCredentialFormatAutoRespondProposalOptions,
  DidCommCredentialFormatAutoRespondRequestOptions,
  DidCommCredentialFormatCreateOfferOptions,
  DidCommCredentialFormatCreateOfferReturn,
  DidCommCredentialFormatCreateProposalOptions,
  DidCommCredentialFormatCreateProposalReturn,
  DidCommCredentialFormatCreateReturn,
  DidCommCredentialFormatProcessCredentialOptions,
  DidCommCredentialFormatProcessOptions,
} from '../DidCommCredentialFormatServiceOptions'
import type {
  DidCommDataIntegrityCredentialFormat,
  DidCommDataIntegrityOfferCredentialFormat,
} from './DidCommDataIntegrityCredentialFormat'
import type { DidCommDataIntegrityLinkSecretBindingProvider } from './DidCommDataIntegrityLinkSecretBinding'
import { DidCommDataIntegrityLinkSecretBindingProviderToken } from './DidCommDataIntegrityLinkSecretBinding'
import type {
  AnonCredsLinkSecretBindingMethod,
  AnonCredsLinkSecretDataIntegrityBindingProof,
  DataIntegrityCredential,
  DataIntegrityCredentialRequest,
  DataIntegrityCredentialRequestBindingProof,
  DidCommSignedAttachmentBindingMethod,
  DidCommSignedAttachmentDataIntegrityBindingProof,
  W3C_VC_DATA_MODEL_VERSION,
} from './dataIntegrityExchange'
import { DataIntegrityCredentialOffer } from './dataIntegrityExchange'

const W3C_DATA_INTEGRITY_CREDENTIAL_OFFER = 'didcomm/w3c-di-vc-offer@v0.1'
const W3C_DATA_INTEGRITY_CREDENTIAL_REQUEST = 'didcomm/w3c-di-vc-request@v0.1'
const W3C_DATA_INTEGRITY_CREDENTIAL = 'didcomm/w3c-di-vc@v0.1'

export class DidCommDataIntegrityCredentialFormatService
  implements DidCommCredentialFormatService<DidCommDataIntegrityCredentialFormat>
{
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
    _agentContext: AgentContext,
    options: DidCommCredentialFormatCreateProposalOptions<DidCommDataIntegrityCredentialFormat>
  ): Promise<DidCommCredentialFormatCreateProposalReturn> {
    throw new CredoError('Not defined')
  }

  public async processProposal(
    _agentContext: AgentContext,
    options: DidCommCredentialFormatProcessOptions
  ): Promise<void> {
    throw new CredoError('Not defined')
  }

  public async acceptProposal(
    _agentContext: AgentContext,
    _input: DidCommCredentialFormatAcceptProposalOptions<DidCommDataIntegrityCredentialFormat>
  ): Promise<DidCommCredentialFormatCreateOfferReturn> {
    throw new CredoError('Not defined')
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
      credentialExchangeRecord,
      attachmentId,
    }: DidCommCredentialFormatCreateOfferOptions<DidCommDataIntegrityCredentialFormat>
  ): Promise<DidCommCredentialFormatCreateOfferReturn> {
    const dataIntegrityFormat = credentialFormats.dataIntegrity
    if (!dataIntegrityFormat) throw new CredoError('Missing data integrity credential format data')

    const format = new DidCommCredentialFormatSpec({
      attachmentId: attachmentId,
      format: W3C_DATA_INTEGRITY_CREDENTIAL_OFFER,
    })

    const credential = dataIntegrityFormat.credential
    if ('proof' in credential) throw new CredoError('The offered credential MUST NOT contain any proofs.')

    const { dataIntegrityCredentialOffer, previewAttributes } = await this.createDataIntegrityCredentialOffer(
      agentContext,
      credentialExchangeRecord,
      dataIntegrityFormat
    )

    const attachment = this.getFormatData(JsonTransformer.toJSON(dataIntegrityCredentialOffer), format.attachmentId)
    return { format, attachment, previewAttributes }
  }

  /**
   * Resolves the provider implementing the `anoncreds_link_secret` binding method, which is
   * registered by the `AnonCredsModule`. Throws when the binding method is used without it.
   */
  private findLinkSecretBindingProvider(
    agentContext: AgentContext
  ): DidCommDataIntegrityLinkSecretBindingProvider | undefined {
    if (!agentContext.dependencyManager.isRegistered(DidCommDataIntegrityLinkSecretBindingProviderToken, true)) {
      return undefined
    }

    return agentContext.dependencyManager.resolve<DidCommDataIntegrityLinkSecretBindingProvider>(
      DidCommDataIntegrityLinkSecretBindingProviderToken
    )
  }

  private getLinkSecretBindingProvider(agentContext: AgentContext): DidCommDataIntegrityLinkSecretBindingProvider {
    const provider = this.findLinkSecretBindingProvider(agentContext)

    if (!provider) {
      throw new CredoError(
        'The anoncreds link secret binding method is not supported. Register the AnonCredsModule to add support for it.'
      )
    }

    return provider
  }

  private getCredentialVersion(credentialJson: JsonObject): W3C_VC_DATA_MODEL_VERSION {
    const context = credentialJson['@context']
    if (!context || !Array.isArray(context)) throw new CredoError('Invalid @context in credential offer')

    const isV1Credential = context.find((c) => c === 'https://www.w3.org/2018/credentials/v1')
    const isV2Credential = context.find((c) => c === 'https://www.w3.org/ns/credentials/v2')

    if (isV1Credential) return '1.1'
    if (isV2Credential) return '2.0'
    throw new CredoError('Cannot determine credential version from @context')
  }

  public async processOffer(
    agentContext: AgentContext,
    { attachment, credentialExchangeRecord }: DidCommCredentialFormatProcessOptions
  ) {
    agentContext.config.logger.debug(
      `Processing data integrity credential offer for credential record ${credentialExchangeRecord.id}`
    )

    const dataIntegrityCredentialOffer = JsonTransformer.fromJSON(
      attachment.getDataAsJson(),
      DataIntegrityCredentialOffer
    )

    const credentialJson = dataIntegrityCredentialOffer.credential
    const credentialVersion = this.getCredentialVersion(credentialJson)

    const credentialToBeValidated = {
      ...credentialJson,
      issuer: credentialJson.issuer ?? 'https://example.com',
      ...(credentialVersion === '1.1'
        ? { issuanceDate: new Date().toISOString() }
        : { validFrom: new Date().toISOString() }),
    }

    if (credentialVersion === '2.0') {
      JsonTransformer.fromJSON(credentialToBeValidated, W3cV2Credential)
    } else {
      JsonTransformer.fromJSON(credentialToBeValidated, W3cCredential)
    }

    const missingBindingMethod =
      dataIntegrityCredentialOffer.bindingRequired &&
      !dataIntegrityCredentialOffer.bindingMethod?.anoncredsLinkSecret &&
      !dataIntegrityCredentialOffer.bindingMethod?.didcommSignedAttachment

    if (missingBindingMethod) {
      throw new DidCommProblemReportError('Invalid credential offer. Missing binding method.', {
        problemCode: DidCommCredentialProblemReportReason.IssuanceAbandoned,
      })
    }
  }

  private async createSignedAttachment(
    agentContext: AgentContext,
    data: { nonce: string },
    options: { alg?: string; kid: string },
    issuerSupportedAlgs: string[]
  ) {
    const { alg, kid } = options

    if (!kid.startsWith('did:')) {
      throw new CredoError(`kid '${kid}' is not a DID. Only dids are supported for kid`)
    }
    if (!kid.includes('#')) {
      throw new CredoError(
        `kid '${kid}' does not contain a fragment. kid MUST point to a specific key in the did document.`
      )
    }

    const parsedDid = parseDid(kid)

    const didsApi = agentContext.dependencyManager.resolve(DidsApi)
    const { didDocument, keys } = await didsApi.resolveCreatedDidDocumentWithKeys(parsedDid.did)
    const verificationMethod = didDocument.dereferenceKey(kid)

    // TODO: we need an util 'getPublicJwkWithSigningKeyIdFromVerificationMethodId'
    const publicJwk = getPublicJwkFromVerificationMethod(verificationMethod)
    const keyId =
      keys?.find(({ didDocumentRelativeKeyId }) => didDocumentRelativeKeyId === `#${parsedDid.fragment}`)?.kmsKeyId ??
      publicJwk.legacyKeyId

    if (alg && !publicJwk.supportedSignatureAlgorithms.includes(alg as Kms.KnownJwaSignatureAlgorithm)) {
      throw new CredoError(`jwk ${publicJwk.jwkTypeHumanDescription}, does not support the JWS signature alg '${alg}'`)
    }

    const signingAlg = issuerSupportedAlgs.find(
      (supportedAlg) =>
        publicJwk.supportedSignatureAlgorithms.includes(supportedAlg as Kms.KnownJwaSignatureAlgorithm) &&
        (alg === undefined || alg === supportedAlg)
    )
    if (!signingAlg) throw new CredoError('No signing algorithm supported by the issuer found')

    const jwsService = agentContext.dependencyManager.resolve(JwsService)
    const jws = await jwsService.createJws(agentContext, {
      keyId,
      header: {},
      payload: new JwtPayload({ additionalClaims: { nonce: data.nonce } }),
      protectedHeaderOptions: { alg: signingAlg as Kms.KnownJwaSignatureAlgorithm, kid },
    })

    const signedAttach = new DidCommAttachment({
      mimeType: 'application/json',
      data: new DidCommAttachmentData({
        base64: TypedArrayEncoder.toBase64(TypedArrayEncoder.fromBase64Url(jws.payload)),
      }),
    })

    signedAttach.addJws(jws)

    return signedAttach
  }

  private async getSignedAttachmentPayload(agentContext: AgentContext, signedAttachment: DidCommAttachment) {
    const jws = signedAttachment.data.jws as JwsDetachedFormat
    if (!jws) throw new CredoError('Missing jws in signed attachment')
    if (!jws.protected) throw new CredoError('Missing protected header in signed attachment')
    if (!signedAttachment.data.base64) throw new CredoError('Missing payload in signed attachment')

    const jwsService = agentContext.dependencyManager.resolve(JwsService)
    const { isValid } = await jwsService.verifyJws(agentContext, {
      jws: {
        header: jws.header,
        protected: jws.protected,
        signature: jws.signature,
        payload: TypedArrayEncoder.toBase64Url(TypedArrayEncoder.fromBase64(signedAttachment.data.base64)),
      },
      allowedJwsSignerMethods: ['did'],
      resolveJwsSigner: async ({ protectedHeader: { kid, alg } }) => {
        if (!kid || typeof kid !== 'string') throw new CredoError('Missing kid in protected header.')
        if (!kid.startsWith('did:')) throw new CredoError('Only did is supported for kid identifier')

        const didsApi = agentContext.dependencyManager.resolve(DidsApi)
        const didDocument = await didsApi.resolveDidDocument(kid)
        const verificationMethod = didDocument.dereferenceKey(kid)
        const publicJwk = getPublicJwkFromVerificationMethod(verificationMethod)

        return {
          alg,
          method: 'did',
          didUrl: kid,
          jwk: publicJwk,
        }
      },
    })

    if (!isValid) throw new CredoError('Failed to validate signature of signed attachment')
    const payload = JsonEncoder.fromBase64(signedAttachment.data.base64) as { nonce: string }
    if (!payload.nonce || typeof payload.nonce !== 'string') {
      throw new CredoError('Invalid payload in signed attachment')
    }

    return payload
  }

  public async acceptOffer(
    agentContext: AgentContext,
    {
      credentialExchangeRecord,
      attachmentId,
      offerAttachment,
      credentialFormats,
    }: DidCommCredentialFormatAcceptOfferOptions<DidCommDataIntegrityCredentialFormat>
  ): Promise<DidCommCredentialFormatCreateReturn> {
    const dataIntegrityFormat = credentialFormats?.dataIntegrity

    const credentialOffer = JsonTransformer.fromJSON(offerAttachment.getDataAsJson(), DataIntegrityCredentialOffer)

    let anonCredsLinkSecretDataIntegrityBindingProof: AnonCredsLinkSecretDataIntegrityBindingProof | undefined
    const autoAcceptOfferWithAnonCredsLinkSecretMethod =
      credentialOffer.bindingRequired &&
      !dataIntegrityFormat?.didCommSignedAttachment &&
      credentialOffer.bindingMethod?.anoncredsLinkSecret

    if (dataIntegrityFormat?.anonCredsLinkSecret || autoAcceptOfferWithAnonCredsLinkSecretMethod) {
      if (!credentialOffer.bindingMethod?.anoncredsLinkSecret) {
        throw new CredoError('Cannot request credential with a binding method that was not offered.')
      }

      anonCredsLinkSecretDataIntegrityBindingProof = await this.getLinkSecretBindingProvider(
        agentContext
      ).createBindingProof(agentContext, {
        credentialExchangeRecord,
        bindingMethod: credentialOffer.bindingMethod.anoncredsLinkSecret,
        linkSecretId: dataIntegrityFormat?.anonCredsLinkSecret?.linkSecretId,
      })
    }

    let didCommSignedAttachmentBindingProof: DidCommSignedAttachmentDataIntegrityBindingProof | undefined
    let didCommSignedAttachment: DidCommAttachment | undefined
    if (dataIntegrityFormat?.didCommSignedAttachment) {
      if (!credentialOffer.bindingMethod?.didcommSignedAttachment) {
        throw new CredoError('Cannot request credential with a binding method that was not offered.')
      }

      didCommSignedAttachment = await this.createSignedAttachment(
        agentContext,
        { nonce: credentialOffer.bindingMethod.didcommSignedAttachment.nonce },
        dataIntegrityFormat.didCommSignedAttachment,
        credentialOffer.bindingMethod.didcommSignedAttachment.algsSupported
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

    if (credentialOffer.bindingRequired && !bindingProof) throw new CredoError('Missing required binding proof')

    const dataModelVersion = dataIntegrityFormat?.dataModelVersion ?? credentialOffer.dataModelVersionsSupported[0]
    if (!credentialOffer.dataModelVersionsSupported.includes(dataModelVersion)) {
      throw new CredoError('Cannot request credential with a data model version that was not offered.')
    }

    const credentialRequest: DataIntegrityCredentialRequest = {
      data_model_version: dataModelVersion,
      binding_proof: bindingProof,
    }

    const format = new DidCommCredentialFormatSpec({
      attachmentId,
      format: W3C_DATA_INTEGRITY_CREDENTIAL_REQUEST,
    })

    const attachment = this.getFormatData(credentialRequest, format.attachmentId)
    return { format, attachment, appendAttachments: didCommSignedAttachment ? [didCommSignedAttachment] : undefined }
  }

  /**
   * Starting from a request is not supported for anoncreds credentials, this method only throws an error.
   */
  public async createRequest(): Promise<DidCommCredentialFormatCreateReturn> {
    throw new CredoError('Starting from a request is not supported for w3c credentials')
  }

  /**
   * We don't have any models to validate an anoncreds request object, for now this method does nothing
   */
  public async processRequest(
    _agentContext: AgentContext,
    _options: DidCommCredentialFormatProcessOptions
  ): Promise<void> {
    // not needed for dataIntegrity
  }

  private async getVerificationMethod(agentContext: AgentContext, issuerId: string, issuerVerificationMethod?: string) {
    const didsApi = agentContext.dependencyManager.resolve(DidsApi)
    const didDocument = await didsApi.resolveDidDocument(issuerId)

    let verificationMethod: VerificationMethod
    if (issuerVerificationMethod) {
      verificationMethod = didDocument.dereferenceKey(issuerVerificationMethod, ['authentication', 'assertionMethod'])
    } else {
      const vms = didDocument.authentication ?? didDocument.assertionMethod ?? didDocument.verificationMethod
      if (!vms || vms.length === 0) {
        throw new CredoError('Missing authenticationMethod, assertionMethod, and verificationMethods in did document')
      }

      if (typeof vms[0] === 'string') {
        verificationMethod = didDocument.dereferenceVerificationMethod(vms[0])
      } else {
        verificationMethod = vms[0]
      }
    }

    return { verificationMethod }
  }

  private async getSignatureMetadata(
    agentContext: AgentContext,
    offeredCredential: W3cCredential,
    issuerVerificationMethod?: string
  ) {
    const { verificationMethod } = await this.getVerificationMethod(
      agentContext,
      offeredCredential.issuerId,
      issuerVerificationMethod
    )

    const signatureSuiteRegistry = agentContext.dependencyManager.resolve(SignatureSuiteRegistry)
    const signatureSuite = signatureSuiteRegistry.getByVerificationMethodType(verificationMethod.type)
    if (!signatureSuite) {
      throw new CredoError(`Could not find signature suite for verification method type ${verificationMethod.type}`)
    }

    return { verificationMethod, signatureSuite, offeredCredential }
  }

  private async assertAndSetCredentialSubjectId<Credential extends W3cCredential | W3cV2Credential>(
    credential: Credential,
    credentialSubjectId: string | undefined
  ) {
    if (!credentialSubjectId) return credential

    if (Array.isArray(credential.credentialSubject)) {
      throw new CredoError('Invalid credential subject relation. Cannot determine the subject to be updated.')
    }

    const subjectId = credential.credentialSubject.id
    if (subjectId && credentialSubjectId !== subjectId) {
      throw new CredoError('Invalid credential subject id.')
    }

    if (!subjectId) credential.credentialSubject.id = credentialSubjectId

    return credential
  }

  /**
   * Secures a data model 2.0 credential with a `DataIntegrityProof`.
   *
   * RFC 0809 leaves the choice of cryptosuite to the issuer, so it is not negotiated with the holder
   * and has to be provided by the issuer.
   */
  private async signV2Credential(
    agentContext: AgentContext,
    credential: W3cV2Credential,
    { cryptosuite, issuerVerificationMethod }: { cryptosuite?: string; issuerVerificationMethod?: string }
  ) {
    if (!cryptosuite) {
      throw new CredoError(
        'Missing cryptosuite. Issuing a VC Data Model 2.0 credential requires the issuer to pick a Data Integrity cryptosuite, which can be provided using the `cryptosuite` data integrity credential format option.'
      )
    }

    const { verificationMethod } = await this.getVerificationMethod(
      agentContext,
      credential.issuerId,
      issuerVerificationMethod
    )

    const w3cV2CredentialService = agentContext.dependencyManager.resolve(W3cV2CredentialService)
    return await w3cV2CredentialService.signCredential<ClaimFormat.DiVc>(agentContext, {
      format: ClaimFormat.DiVc,
      credential,
      cryptosuite,
      verificationMethod: verificationMethod.id,
    })
  }

  private async signCredential(
    agentContext: AgentContext,
    credential: W3cCredential | W3cJsonLdVerifiableCredential,
    issuerVerificationMethod?: string
  ) {
    const { signatureSuite, verificationMethod } = await this.getSignatureMetadata(
      agentContext,
      credential,
      issuerVerificationMethod
    )
    const w3cCredentialService = agentContext.dependencyManager.resolve(W3cCredentialService)

    let credentialToBeSigned = credential
    if (credential instanceof W3cJsonLdVerifiableCredential) {
      const { proof, ..._credentialToBeSigned } = credential
      credentialToBeSigned = _credentialToBeSigned as W3cCredential
    }

    const w3cJsonLdVerifiableCredential = (await w3cCredentialService.signCredential(agentContext, {
      format: ClaimFormat.LdpVc,
      credential: credentialToBeSigned as W3cCredential,
      proofType: signatureSuite.proofType,
      verificationMethod: verificationMethod.id,
    })) as W3cJsonLdVerifiableCredential

    if (Array.isArray(w3cJsonLdVerifiableCredential.proof)) {
      throw new CredoError('A newly signed credential can not have multiple proofs')
    }

    if (credential instanceof W3cJsonLdVerifiableCredential) {
      const combinedProofs = Array.isArray(credential.proof) ? credential.proof : [credential.proof]
      combinedProofs.push(w3cJsonLdVerifiableCredential.proof)
      w3cJsonLdVerifiableCredential.proof = combinedProofs
    }
    return w3cJsonLdVerifiableCredential
  }

  public async acceptRequest(
    agentContext: AgentContext,
    {
      credentialFormats,
      credentialExchangeRecord,
      attachmentId,
      offerAttachment,
      requestAttachment,
      requestAppendAttachments,
    }: DidCommCredentialFormatAcceptRequestOptions<DidCommDataIntegrityCredentialFormat>
  ): Promise<DidCommCredentialFormatCreateReturn> {
    const dataIntegrityFormat = credentialFormats?.dataIntegrity

    const credentialOffer = JsonTransformer.fromJSON(offerAttachment?.getDataAsJson(), DataIntegrityCredentialOffer)

    const credentialRequest = requestAttachment.getDataAsJson<DataIntegrityCredentialRequest>()
    if (!credentialRequest) throw new CredoError('Missing data integrity credential request in createCredential')

    const format = new DidCommCredentialFormatSpec({
      attachmentId,
      format: W3C_DATA_INTEGRITY_CREDENTIAL,
    })

    // A data model 2.0 credential is secured with a DataIntegrityProof rather than a linked data
    // signature suite, and is never bound using the anoncreds link secret binding method.
    if (credentialRequest.data_model_version === '2.0') {
      if (credentialRequest.binding_proof?.anoncreds_link_secret) {
        throw new CredoError(
          'The anoncreds link secret binding method is not supported for VC Data Model 2.0 credentials.'
        )
      }

      const assertedV2Credential = await this.assertAndSetCredentialSubjectId(
        JsonTransformer.fromJSON(credentialOffer.credential, W3cV2Credential),
        dataIntegrityFormat?.credentialSubjectId
      )

      const signedV2Credential = await this.signV2Credential(agentContext, assertedV2Credential, {
        cryptosuite: dataIntegrityFormat?.cryptosuite,
        issuerVerificationMethod: dataIntegrityFormat?.issuerVerificationMethod,
      })

      return {
        format,
        attachment: this.getFormatData(
          { credential: JsonTransformer.toJSON(signedV2Credential.securedCredential) },
          format.attachmentId
        ),
      }
    }

    const assertedCredential = await this.assertAndSetCredentialSubjectId(
      JsonTransformer.fromJSON(credentialOffer.credential, W3cCredential),
      dataIntegrityFormat?.credentialSubjectId
    )

    let signedCredential: W3cJsonLdVerifiableCredential | undefined
    if (credentialRequest.binding_proof?.anoncreds_link_secret) {
      if (!credentialOffer.bindingMethod?.anoncredsLinkSecret) {
        throw new CredoError('Cannot issue credential with a binding method that was not offered')
      }

      const issuedCredential = await this.getLinkSecretBindingProvider(agentContext).issueBoundCredential(
        agentContext,
        {
          credentialExchangeRecord,
          bindingMethod: credentialOffer.bindingMethod.anoncredsLinkSecret,
          bindingProof: credentialRequest.binding_proof.anoncreds_link_secret,
          credentialSubjectId: dataIntegrityFormat?.credentialSubjectId,
        }
      )

      signedCredential = JsonTransformer.fromJSON(issuedCredential, W3cJsonLdVerifiableCredential)
    }

    if (credentialRequest.binding_proof?.didcomm_signed_attachment) {
      if (!credentialOffer.bindingMethod?.didcommSignedAttachment) {
        throw new CredoError('Cannot issue credential with a binding method that was not offered')
      }

      const bindingProofAttachment = requestAppendAttachments?.find(
        (attachments) => attachments.id === credentialRequest.binding_proof?.didcomm_signed_attachment?.attachment_id
      )
      if (!bindingProofAttachment) throw new CredoError('Missing binding proof attachment')

      const { nonce } = await this.getSignedAttachmentPayload(agentContext, bindingProofAttachment)
      if (nonce !== credentialOffer.bindingMethod.didcommSignedAttachment.nonce) {
        throw new CredoError('Invalid nonce in signed attachment')
      }

      signedCredential = await this.signCredential(
        agentContext,
        signedCredential ?? assertedCredential,
        dataIntegrityFormat?.issuerVerificationMethod
      )
    }

    if (
      !credentialRequest.binding_proof?.anoncreds_link_secret &&
      !credentialRequest.binding_proof?.didcomm_signed_attachment
    ) {
      signedCredential = await this.signCredential(agentContext, assertedCredential)
    }

    const attachment = this.getFormatData({ credential: JsonTransformer.toJSON(signedCredential) }, format.attachmentId)
    return { format, attachment }
  }

  /**
   * Processes an incoming credential - retrieve metadata, retrieve payload and store it in wallet
   * @param options the issue credential message wrapped inside this object
   * @param credentialExchangeRecord the credential exchange record for this credential
   */
  public async processCredential(
    agentContext: AgentContext,
    {
      credentialExchangeRecord,
      attachment,
      requestAttachment,
      offerAttachment,
    }: DidCommCredentialFormatProcessCredentialOptions
  ): Promise<void> {
    const credentialOffer = JsonTransformer.fromJSON(offerAttachment.getDataAsJson(), DataIntegrityCredentialOffer)
    const offeredCredentialJson = credentialOffer.credential

    const credentialRequest = requestAttachment.getDataAsJson<DataIntegrityCredentialRequest>()
    if (!credentialRequest) throw new CredoError('Missing data integrity credential request in createCredential')

    if (!credentialExchangeRecord.credentialAttributes) {
      throw new CredoError('Missing credential attributes on credential record.')
    }

    const { credential: credentialJson } = attachment.getDataAsJson<DataIntegrityCredential>()

    if (Array.isArray(offeredCredentialJson.credentialSubject)) {
      throw new CredoError('Invalid credential subject. Multiple credential subjects are not yet supported.')
    }

    const credentialSubjectMatches = Object.entries(offeredCredentialJson.credentialSubject as JsonObject).every(
      ([key, offeredValue]) => {
        const receivedValue = (credentialJson.credentialSubject as JsonObject)[key]
        if (!offeredValue || !receivedValue) return false

        if (typeof offeredValue === 'number' || typeof receivedValue === 'number') {
          return offeredValue.toString() === receivedValue.toString()
        }

        return deepEquality(offeredValue, receivedValue)
      }
    )

    if (!credentialSubjectMatches) {
      throw new CredoError(
        'Received invalid credential. Received credential subject does not match the offered credential subject.'
      )
    }

    const credentialVersion = this.getCredentialVersion(credentialJson)
    const expectedReceivedCredential = {
      ...offeredCredentialJson,
      '@context': credentialJson['@context'],
      issuer: offeredCredentialJson.issuer ?? credentialJson.issuer,
      credentialSubject: credentialJson.credentialSubject,
      ...(credentialVersion === '1.1' && { issuanceDate: credentialJson.issuanceDate }),
      ...(credentialVersion === '2.0' && { validFrom: credentialJson.validFrom }),
      ...(offeredCredentialJson.credentialStatus && { credentialStatus: credentialJson.credentialStatus }),
      proof: credentialJson.proof,
    }

    if (!deepEquality(credentialJson, expectedReceivedCredential)) {
      throw new CredoError('Received invalid credential. Received credential does not match the offered credential')
    }

    // A data model 2.0 credential is secured with a DataIntegrityProof and is held in a
    // W3cV2CredentialRecord, as W3cCredentialRecord only holds data model 1.1 credentials.
    if (credentialVersion === '2.0') {
      const w3cV2CredentialService = agentContext.dependencyManager.resolve(W3cV2CredentialService)
      const credential = W3cV2DataIntegrityVerifiableCredential.fromObject(
        credentialJson as Parameters<typeof W3cV2DataIntegrityVerifiableCredential.fromObject>[0]
      )

      const result = await w3cV2CredentialService.verifyCredential(agentContext, { credential })
      if (result && !result.isValid) {
        throw new CredoError(`Failed to validate credential, error = ${result.error}`)
      }

      const w3cV2CredentialRecord = await w3cV2CredentialService.storeCredential(agentContext, {
        record: W3cV2CredentialRecord.fromCredential(credential),
      })

      credentialExchangeRecord.credentials.push({
        credentialRecordType: 'w3c-v2',
        credentialRecordId: w3cV2CredentialRecord.id,
      })

      return
    }

    let credentialRecordId: string
    if (credentialRequest.binding_proof?.anoncreds_link_secret) {
      credentialRecordId = await this.getLinkSecretBindingProvider(agentContext).storeBoundCredential(agentContext, {
        credentialExchangeRecord,
        credentialJson,
        offeredCredentialJson,
      })
    } else {
      const w3cCredentialService = agentContext.dependencyManager.resolve(W3cCredentialService)
      const w3cJsonLdVerifiableCredential = JsonTransformer.fromJSON(credentialJson, W3cJsonLdVerifiableCredential)
      const w3cCredentialRecord = await w3cCredentialService.storeCredential(agentContext, {
        record: W3cCredentialRecord.fromCredential(w3cJsonLdVerifiableCredential),
      })
      credentialRecordId = w3cCredentialRecord.id
    }

    credentialExchangeRecord.credentials.push({
      credentialRecordType: this.credentialRecordType,
      credentialRecordId,
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
   * @returns The DidCommAttachment if found or undefined
   *
   */
  public getAttachment(
    formats: DidCommCredentialFormatSpec[],
    messageAttachments: DidCommAttachment[]
  ): DidCommAttachment | undefined {
    const supportedAttachmentIds = formats.filter((f) => this.supportsFormat(f.format)).map((f) => f.attachmentId)
    const supportedAttachment = messageAttachments.find((attachment) => supportedAttachmentIds.includes(attachment.id))

    return supportedAttachment
  }

  public async deleteCredentialById(agentContext: AgentContext, credentialRecordId: string): Promise<void> {
    // A credential bound using the anoncreds link secret is stored through the anoncreds holder
    // service and has to be deleted through it as well, so that its anoncreds state is cleaned up.
    // Credentials bound using any other method, or not bound at all, are plain w3c credential records.
    const linkSecretBindingProvider = this.findLinkSecretBindingProvider(agentContext)

    if (await linkSecretBindingProvider?.ownsCredentialRecord(agentContext, credentialRecordId)) {
      await linkSecretBindingProvider?.deleteCredentialById(agentContext, credentialRecordId)
      return
    }

    const w3cCredentialService = agentContext.dependencyManager.resolve(W3cCredentialService)
    const w3cV2CredentialService = agentContext.dependencyManager.resolve(W3cV2CredentialService)

    try {
      await w3cCredentialService.getCredentialRecordById(agentContext, credentialRecordId)
    } catch {
      // A data model 2.0 credential is held in a W3cV2CredentialRecord instead
      await w3cV2CredentialService.removeCredentialRecord(agentContext, credentialRecordId)
      return
    }

    await w3cCredentialService.removeCredentialRecord(agentContext, credentialRecordId)
  }

  public async shouldAutoRespondToProposal(
    _agentContext: AgentContext,
    options: DidCommCredentialFormatAutoRespondProposalOptions
  ): Promise<boolean> {
    throw new CredoError('Not implemented')
  }

  public async shouldAutoRespondToOffer(
    _agentContext: AgentContext,
    { offerAttachment }: DidCommCredentialFormatAutoRespondOfferOptions
  ) {
    const credentialOffer = JsonTransformer.fromJSON(offerAttachment.getDataAsJson(), DataIntegrityCredentialOffer)
    if (!credentialOffer.bindingRequired) return true
    return false
  }

  public async shouldAutoRespondToRequest(
    _agentContext: AgentContext,
    { offerAttachment, requestAttachment }: DidCommCredentialFormatAutoRespondRequestOptions
  ) {
    const credentialOffer = JsonTransformer.fromJSON(offerAttachment?.getDataAsJson(), DataIntegrityCredentialOffer)
    const credentialRequest = requestAttachment.getDataAsJson<DataIntegrityCredentialRequest>()

    if (
      !credentialOffer.bindingRequired &&
      !credentialRequest.binding_proof?.anoncreds_link_secret &&
      !credentialRequest.binding_proof?.didcomm_signed_attachment
    ) {
      return true
    }

    if (
      credentialOffer.bindingRequired &&
      !credentialRequest.binding_proof?.anoncreds_link_secret &&
      !credentialRequest.binding_proof?.didcomm_signed_attachment
    ) {
      return false
    }

    // cannot auto response credential subject id must be set manually
    if (credentialRequest.binding_proof?.didcomm_signed_attachment) {
      try {
        const subjectJson = credentialOffer.credential.credentialSubject
        const credentialSubject = JsonTransformer.fromJSON(subjectJson, W3cCredentialSubject)
        if (credentialSubject.id === undefined) return false
      } catch (_e) {
        return false
      }
    }

    const validLinkSecretRequest =
      !credentialRequest.binding_proof?.anoncreds_link_secret ||
      (credentialRequest.binding_proof?.anoncreds_link_secret && credentialOffer.bindingMethod?.anoncredsLinkSecret)

    const validDidCommSignedAttachmetRequest =
      !credentialRequest.binding_proof?.didcomm_signed_attachment ||
      (credentialRequest.binding_proof?.didcomm_signed_attachment &&
        credentialOffer.bindingMethod?.didcommSignedAttachment)

    return Boolean(validLinkSecretRequest && validDidCommSignedAttachmetRequest)
  }

  public async shouldAutoRespondToCredential(
    _agentContext: AgentContext,
    options: DidCommCredentialFormatAutoRespondCredentialOptions
  ) {
    return true
  }

  private async createDataIntegrityCredentialOffer(
    agentContext: AgentContext,
    credentialExchangeRecord: DidCommCredentialExchangeRecord,
    options: DidCommDataIntegrityOfferCredentialFormat
  ): Promise<{
    dataIntegrityCredentialOffer: DataIntegrityCredentialOffer
    previewAttributes: DidCommCredentialPreviewAttributeOptions[]
  }> {
    const {
      bindingRequired,
      credential,
      anonCredsLinkSecretBinding: anonCredsLinkSecretBindingMethodOptions,
      didCommSignedAttachmentBinding: didCommSignedAttachmentBindingMethodOptions,
    } = options

    const credentialJson =
      credential instanceof W3cCredential || credential instanceof W3cV2Credential
        ? JsonTransformer.toJSON(credential)
        : credential

    // The offered credential MUST conform to the first supported data model version, so the version
    // of the credential we are offering is the version we advertise.
    const dataModelVersion = this.getCredentialVersion(credentialJson)
    const dataModelVersionsSupported: W3C_VC_DATA_MODEL_VERSION[] = [dataModelVersion]

    // The anoncreds link secret binding method is defined in terms of the anoncredsvc-2023
    // cryptosuite and data model 1.1 only.
    if (dataModelVersion === '2.0' && anonCredsLinkSecretBindingMethodOptions) {
      throw new CredoError(
        'The anoncreds link secret binding method is not supported for VC Data Model 2.0 credentials.'
      )
    }

    // validate the credential and get the preview attributes
    const validW3cCredential =
      dataModelVersion === '2.0'
        ? JsonTransformer.fromJSON(credentialJson, W3cV2Credential)
        : JsonTransformer.fromJSON(credentialJson, W3cCredential)
    const previewAttributes = this.previewAttributesFromCredential(validW3cCredential)

    let anonCredsLinkSecretBindingMethod: AnonCredsLinkSecretBindingMethod | undefined
    if (anonCredsLinkSecretBindingMethodOptions) {
      anonCredsLinkSecretBindingMethod = await this.getLinkSecretBindingProvider(agentContext).createOfferBindingMethod(
        agentContext,
        {
          credentialExchangeRecord,
          ...anonCredsLinkSecretBindingMethodOptions,
          offeredCredential: credentialJson,
        }
      )
    }

    let didCommSignedAttachmentBindingMethod: DidCommSignedAttachmentBindingMethod | undefined
    if (didCommSignedAttachmentBindingMethodOptions) {
      const kms = agentContext.dependencyManager.resolve(Kms.KeyManagementApi)

      const { didMethodsSupported, algsSupported } = didCommSignedAttachmentBindingMethodOptions
      didCommSignedAttachmentBindingMethod = {
        didMethodsSupported:
          didMethodsSupported ?? agentContext.dependencyManager.resolve(DidsApi).supportedResolverMethods,
        algsSupported: algsSupported ?? this.getSupportedJwaSignatureAlgorithms(agentContext),
        nonce: TypedArrayEncoder.toBase64Url(kms.randomBytes({ length: 32 })),
      }

      if (didCommSignedAttachmentBindingMethod.algsSupported.length === 0) {
        throw new CredoError('No supported JWA signature algorithms found.')
      }

      if (didCommSignedAttachmentBindingMethod.didMethodsSupported.length === 0) {
        throw new CredoError('No supported DID methods found.')
      }
    }

    if (bindingRequired && !anonCredsLinkSecretBindingMethod && !didCommSignedAttachmentBindingMethod) {
      throw new CredoError('Missing required binding method.')
    }

    const dataIntegrityCredentialOffer = new DataIntegrityCredentialOffer({
      dataModelVersionsSupported,
      bindingRequired: bindingRequired,
      bindingMethod: {
        anoncredsLinkSecret: anonCredsLinkSecretBindingMethod,
        didcommSignedAttachment: didCommSignedAttachmentBindingMethod,
      },
      credential: credentialJson,
    })

    return { dataIntegrityCredentialOffer, previewAttributes }
  }

  private previewAttributesFromCredential(
    credential: W3cCredential | W3cV2Credential
  ): DidCommCredentialPreviewAttributeOptions[] {
    const credentialSubject = credential.credentialSubject
    if (Array.isArray(credentialSubject)) {
      throw new CredoError('Credential subject must be an object.')
    }

    // Data model 1.1 nests the claims under `claims`, data model 2.0 holds them on the subject itself
    const claims = {
      ...(credentialSubject instanceof W3cCredentialSubject
        ? credentialSubject.claims
        : Object.fromEntries(Object.entries(credentialSubject).filter(([key]) => key !== 'id'))),
      ...(credentialSubject.id && { id: credentialSubject.id }),
    } as Record<string, string | number>
    const attributes = Object.entries(claims).map(([key, value]): DidCommCredentialPreviewAttributeOptions => {
      return { name: key, value: value.toString() }
    })
    return attributes
  }

  /**
   * Returns an object of type {@link DidCommAttachment} for use in credential exchange messages.
   * It looks up the correct format identifier and encodes the data as a base64 attachment.
   *
   * @param data The data to include in the attach object
   * @param id the attach id from the formats component of the message
   */
  public getFormatData(data: unknown, id: string): DidCommAttachment {
    const attachment = new DidCommAttachment({
      id,
      mimeType: 'application/json',
      data: {
        base64: JsonEncoder.toBase64(data),
      },
    })

    return attachment
  }

  /**
   * Returns the JWA Signature Algorithms that are supported by the agent.
   */
  private getSupportedJwaSignatureAlgorithms(agentContext: AgentContext): Kms.KnownJwaSignatureAlgorithm[] {
    const kms = agentContext.dependencyManager.resolve(Kms.KeyManagementApi)

    const supportedSignatureAlgorithms = Object.values(Kms.KnownJwaSignatureAlgorithms).filter(
      (algorithm) =>
        kms.supportedBackendsForOperation({
          operation: 'sign',
          algorithm,
        }).length > 0
    )

    return supportedSignatureAlgorithms
  }
}
