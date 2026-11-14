import type { AgentContext, JsonObject, JwsDetachedFormat, SdJwtVcHolderBinding, SingleOrArray } from '@credo-ts/core'
import {
  ClaimFormat,
  CredoError,
  DidsApi,
  deepEquality,
  getPublicJwkFromVerificationMethod,
  isJsonObject,
  JsonEncoder,
  JsonTransformer,
  Kms,
  parseDid,
  TypedArrayEncoder,
  validateW3cV2SdJwtDisclosureFrame,
  W3cV2Credential,
  W3cV2CredentialRecord,
  W3cV2CredentialService,
  W3cV2SdJwtVerifiableCredential,
} from '@credo-ts/core'
import type { DidCommAttachment } from '../../../../decorators/attachment/DidCommAttachment'
import { DidCommProblemReportError } from '../../../../errors/problem-reports/DidCommProblemReportError'
import { DidCommMessageRepository, DidCommMessageRole } from '../../../../repository'
import { DidCommCredentialFormatSpec } from '../../models/DidCommCredentialFormatSpec'
import { DidCommCredentialProblemReportReason } from '../../models/DidCommCredentialProblemReportReason'
import { V2CredentialProblemReportError } from '../../protocol/v2/errors'
import { DidCommOfferCredentialV2Message } from '../../protocol/v2/messages/DidCommOfferCredentialV2Message'
import { assertAndSetCredentialSubjectId, assertCredentialSubjectMatchesOffer } from '../../util/credentialSubject'
import { createDidCommSignedAttachment, verifyDidCommSignedAttachment } from '../../util/didCommSignedAttachment'
import { getFormatDataAttachment } from '../../util/formatData'
import { selectJwaSignatureAlgorithm } from '../../util/signatureAlgorithm'
import { getIssuerVerificationMethod } from '../../util/verificationMethod'
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
  DidCommCredentialFormatCreateRequestOptions,
  DidCommCredentialFormatCreateReturn,
  DidCommCredentialFormatProcessCredentialOptions,
  DidCommCredentialFormatProcessOptions,
  DidCommCredentialFormatProcessRequestOptions,
} from '../DidCommCredentialFormatServiceOptions'
import type { DidCommW3cV2SdJwtCredentialFormat } from './DidCommW3cV2SdJwtCredentialFormat'
import {
  claimPathsFromDisclosureFrame,
  disclosureFrameFromClaimPaths,
  isArrayElementDisclosureDigest,
  resolveClaimPath,
} from './disclosureFrame'
import {
  W3cV2SdJwtBindingMethods,
  type W3cV2SdJwtCredential,
  W3cV2SdJwtCredentialOffer,
  type W3cV2SdJwtCredentialRequest,
  type W3cV2SdJwtCredentialRequestBindingProof,
  W3cV2SdJwtDidCommSignedAttachmentBindingMethod,
} from './w3cV2SdJwtExchange'

/**
 * JWT and SD-JWT registered claims that live alongside the credential in the SD-JWT payload, but are not
 * properties of a VC Data Model 2.0 credential. They are ignored when comparing a received credential
 * against the offered one.
 */
const NON_CREDENTIAL_CLAIMS = ['iss', 'sub', 'aud', 'exp', 'nbf', 'iat', 'jti', 'cnf', '_sd', '_sd_alg']

const W3C_V2_SD_JWT_OFFER = 'didcomm/w3c-vc-sd-jwt-offer@v1.0'
const W3C_V2_SD_JWT_REQUEST = 'didcomm/w3c-vc-sd-jwt-request@v1.0'
const W3C_V2_SD_JWT_CREDENTIAL = 'didcomm/w3c-vc-sd-jwt@v1.0'

export class DidCommW3cV2SdJwtCredentialFormatService
  implements DidCommCredentialFormatService<DidCommW3cV2SdJwtCredentialFormat>
{
  public readonly formatKey = 'w3cV2SdJwt' as const
  public readonly credentialRecordType = 'w3c-v2' as const

  public async createProposal(
    _agentContext: AgentContext,
    _options: DidCommCredentialFormatCreateProposalOptions<DidCommW3cV2SdJwtCredentialFormat>
  ): Promise<DidCommCredentialFormatCreateProposalReturn> {
    throw new CredoError('Proposal is not supported for W3C VCDM 2.0 SD-JWT credential format')
  }

  public async processProposal(_agentContext: AgentContext, _options: DidCommCredentialFormatProcessOptions) {
    throw new CredoError('Proposal is not supported for W3C VCDM 2.0 SD-JWT credential format')
  }

  public async acceptProposal(
    _agentContext: AgentContext,
    _options: DidCommCredentialFormatAcceptProposalOptions<DidCommW3cV2SdJwtCredentialFormat>
  ): Promise<DidCommCredentialFormatCreateOfferReturn> {
    throw new CredoError('Proposal is not supported for W3C VCDM 2.0 SD-JWT credential format')
  }

  public async createOffer(
    agentContext: AgentContext,
    { credentialFormats, attachmentId }: DidCommCredentialFormatCreateOfferOptions<DidCommW3cV2SdJwtCredentialFormat>
  ): Promise<DidCommCredentialFormatCreateOfferReturn> {
    const w3cV2SdJwtFormat = credentialFormats.w3cV2SdJwt
    if (!w3cV2SdJwtFormat) throw new CredoError('Missing w3cV2SdJwt credential format data')

    const { credential, bindingRequired, disclosureFrame, didCommSignedAttachmentBinding } = w3cV2SdJwtFormat

    // Reject a frame core would refuse to sign, rather than sending an offer that cannot be fulfilled
    validateW3cV2SdJwtDisclosureFrame(disclosureFrame)

    // Build the binding method whenever binding options are given, so that a binding can be offered
    // without being required. The holder then decides whether to bind the credential.
    let bindingMethod: W3cV2SdJwtBindingMethods | undefined
    if (didCommSignedAttachmentBinding) {
      const kms = agentContext.dependencyManager.resolve(Kms.KeyManagementApi)
      const didsApi = agentContext.dependencyManager.resolve(DidsApi)

      const algsSupported = didCommSignedAttachmentBinding.algsSupported ?? kms.supportedJwaSignatureAlgorithms()
      const didMethodsSupported = didCommSignedAttachmentBinding.didMethodsSupported ?? didsApi.supportedResolverMethods

      if (algsSupported.length === 0) throw new CredoError('No supported JWA signature algorithms found.')
      if (didMethodsSupported.length === 0) throw new CredoError('No supported DID methods found.')

      bindingMethod = new W3cV2SdJwtBindingMethods({
        didcommSignedAttachment: new W3cV2SdJwtDidCommSignedAttachmentBindingMethod({
          algsSupported,
          didMethodsSupported,
          nonce: TypedArrayEncoder.toBase64Url(kms.randomBytes({ length: 32 })),
        }),
      })
    }

    if (bindingRequired && !bindingMethod) throw new CredoError('Missing required binding method.')

    const credentialOffer = new W3cV2SdJwtCredentialOffer({
      bindingRequired,
      bindingMethod,
      selectivelyDisclosableClaims: disclosureFrame ? claimPathsFromDisclosureFrame(disclosureFrame) : undefined,
      credential,
    })

    const credentialJson = credentialOffer.credential
    if ('proof' in credentialJson) throw new CredoError('The offered credential MUST NOT contain any proofs.')

    // Validate credential as VCDM 2.0 (with offer exceptions: `issuer` can be missing)
    const credentialToValidate = {
      ...credentialJson,
      issuer: credentialJson.issuer ?? 'https://placeholder.com',
    }
    JsonTransformer.fromJSON(credentialToValidate, W3cV2Credential)

    const format = new DidCommCredentialFormatSpec({
      attachmentId,
      format: W3C_V2_SD_JWT_OFFER,
    })

    const attachment = getFormatDataAttachment(JsonTransformer.toJSON(credentialOffer), format.attachmentId)
    return { format, attachment }
  }

  public async processOffer(
    _agentContext: AgentContext,
    { attachment }: DidCommCredentialFormatProcessOptions
  ): Promise<void> {
    const credentialOffer = JsonTransformer.fromJSON(attachment.getDataAsJson(), W3cV2SdJwtCredentialOffer)

    // Validate the credential in the offer (with exceptions)
    const credentialJson = credentialOffer.credential
    const credentialToValidate = {
      ...credentialJson,
      issuer: credentialJson.issuer ?? 'https://placeholder.com',
    }
    JsonTransformer.fromJSON(credentialToValidate, W3cV2Credential)

    if (credentialOffer.bindingRequired && !credentialOffer.bindingMethod?.didcommSignedAttachment) {
      throw new DidCommProblemReportError('Invalid credential offer. Missing binding method.', {
        problemCode: DidCommCredentialProblemReportReason.IssuanceAbandoned,
      })
    }

    // An offer naming a non-discloseable field can never be fulfilled by the issuer
    validateW3cV2SdJwtDisclosureFrame(disclosureFrameFromClaimPaths(credentialOffer.selectivelyDisclosableClaims))
  }

  public async acceptOffer(
    agentContext: AgentContext,
    {
      offerAttachment,
      attachmentId,
      credentialFormats,
    }: DidCommCredentialFormatAcceptOfferOptions<DidCommW3cV2SdJwtCredentialFormat>
  ): Promise<DidCommCredentialFormatCreateReturn> {
    const credentialOffer = JsonTransformer.fromJSON(offerAttachment.getDataAsJson(), W3cV2SdJwtCredentialOffer)

    let signedAttachment: DidCommAttachment | undefined
    let bindingProof: W3cV2SdJwtCredentialRequestBindingProof | undefined

    // Bind the credential whenever the holder asks for it, even if the issuer did not require it
    const didCommSignedAttachmentOptions = credentialFormats?.w3cV2SdJwt?.didCommSignedAttachment
    if (didCommSignedAttachmentOptions) {
      const bindingMethod = credentialOffer.bindingMethod?.didcommSignedAttachment
      if (!bindingMethod) {
        throw new CredoError('Cannot request credential with a binding method that was not offered.')
      }

      signedAttachment = await createDidCommSignedAttachment(
        agentContext,
        { nonce: bindingMethod.nonce },
        didCommSignedAttachmentOptions,
        bindingMethod.algsSupported,
        { allowedPurposes: ['authentication'], didMethodsSupported: bindingMethod.didMethodsSupported }
      )

      bindingProof = {
        didcomm_signed_attachment: { attachment_id: signedAttachment.id },
      }
    }

    if (credentialOffer.bindingRequired && !bindingProof) throw new CredoError('Missing required binding proof')

    const credentialRequest: W3cV2SdJwtCredentialRequest = {
      binding_proof: bindingProof,
    }

    const format = new DidCommCredentialFormatSpec({
      attachmentId,
      format: W3C_V2_SD_JWT_REQUEST,
    })

    const attachment = getFormatDataAttachment(credentialRequest, format.attachmentId)
    return {
      format,
      attachment,
      appendAttachments: signedAttachment ? [signedAttachment] : undefined,
    }
  }

  public async createRequest(
    _agentContext: AgentContext,
    _options: DidCommCredentialFormatCreateRequestOptions<DidCommW3cV2SdJwtCredentialFormat>
  ): Promise<DidCommCredentialFormatCreateReturn> {
    throw new CredoError('Starting from a request is not supported for W3C VCDM 2.0 SD-JWT credentials')
  }

  public async processRequest(
    agentContext: AgentContext,
    { credentialExchangeRecord, attachment, requestAppendAttachments }: DidCommCredentialFormatProcessRequestOptions
  ): Promise<void> {
    const offerMessage = await agentContext.dependencyManager
      .resolve(DidCommMessageRepository)
      .findAgentMessage(agentContext, {
        associatedRecordId: credentialExchangeRecord.id,
        messageClass: DidCommOfferCredentialV2Message,
        role: DidCommMessageRole.Sender,
      })
    const offerFormat = offerMessage?.formats.find(({ format }) => format === W3C_V2_SD_JWT_OFFER)
    const offerAttachment = offerFormat && offerMessage?.getOfferAttachmentById(offerFormat.attachmentId)
    if (!offerAttachment) {
      throw new V2CredentialProblemReportError(
        'A vc+sd-jwt credential request must answer a vc+sd-jwt credential offer in the same thread',
        { problemCode: DidCommCredentialProblemReportReason.IssuanceAbandoned }
      )
    }

    try {
      await this.verifyBindingProof(
        agentContext,
        JsonTransformer.fromJSON(offerAttachment.getDataAsJson(), W3cV2SdJwtCredentialOffer),
        attachment.getDataAsJson<W3cV2SdJwtCredentialRequest>(),
        requestAppendAttachments
      )
    } catch (error) {
      throw new V2CredentialProblemReportError(error.message, {
        problemCode: DidCommCredentialProblemReportReason.IssuanceAbandoned,
      })
    }
  }

  public async acceptRequest(
    agentContext: AgentContext,
    {
      credentialFormats,
      attachmentId,
      offerAttachment,
      requestAttachment,
      requestAppendAttachments,
    }: DidCommCredentialFormatAcceptRequestOptions<DidCommW3cV2SdJwtCredentialFormat>
  ): Promise<DidCommCredentialFormatCreateReturn> {
    const w3cV2SdJwtFormat = credentialFormats?.w3cV2SdJwt

    if (!offerAttachment) throw new CredoError('Missing offer attachment')
    const credentialOffer = JsonTransformer.fromJSON(offerAttachment.getDataAsJson(), W3cV2SdJwtCredentialOffer)
    const credentialRequest = requestAttachment.getDataAsJson<W3cV2SdJwtCredentialRequest>()

    let proofHolder: SdJwtVcHolderBinding | undefined
    try {
      proofHolder = await this.verifyBindingProof(
        agentContext,
        credentialOffer,
        credentialRequest,
        requestAppendAttachments
      )
    } catch (error) {
      throw new V2CredentialProblemReportError(error.message, {
        problemCode: DidCommCredentialProblemReportReason.IssuanceAbandoned,
      })
    }

    if (proofHolder && w3cV2SdJwtFormat?.holder && !deepEquality(w3cV2SdJwtFormat.holder, proofHolder)) {
      throw new CredoError('The holder must be the key of the binding proof in the request')
    }
    const holder = proofHolder ?? w3cV2SdJwtFormat?.holder

    // Tranform the credential
    const w3cV2CredentialService = agentContext.dependencyManager.resolve(W3cV2CredentialService)

    // RFC 881 allows the offer to omit the issuer when it is only known at time of issuance, while the
    // data model requires one, so it may need to be supplied here.
    const issuer = credentialOffer.credential.issuer ?? w3cV2SdJwtFormat?.issuer
    if (!issuer) {
      throw new CredoError(
        'The offered credential has no issuer. Provide one using the `issuer` w3cV2SdJwt accept request option.'
      )
    }

    const credential = JsonTransformer.fromJSON({ ...credentialOffer.credential, issuer }, W3cV2Credential)

    // Set credentialSubject.id from the caller supplied id and/or the holder binding DID. Applying both
    // in turn means a conflict between them is rejected rather than silently resolved.
    assertAndSetCredentialSubjectId(credential, w3cV2SdJwtFormat?.credentialSubjectId)
    if (holder?.method === 'did') {
      assertAndSetCredentialSubjectId(credential, parseDid(holder.didUrl).did)
    }

    // Determine the verification method and signing algorithm. Only `assertionMethod` is allowed, as
    // that is the purpose core requires when signing a W3C VCDM 2.0 SD-JWT credential.
    const { verificationMethod } = await getIssuerVerificationMethod(agentContext, {
      issuerId: credential.issuerId,
      verificationMethodId: w3cV2SdJwtFormat?.issuerVerificationMethod,
      allowedPurposes: ['assertionMethod'],
    })

    const alg = selectJwaSignatureAlgorithm(agentContext, {
      publicJwk: getPublicJwkFromVerificationMethod(verificationMethod),
      requestedAlg: w3cV2SdJwtFormat?.alg,
    })

    const verifiableCredential = await w3cV2CredentialService.signCredential(agentContext, {
      format: ClaimFormat.SdJwtW3cVc,
      credential,
      verificationMethod: verificationMethod.id,
      alg,
      holder,
      disclosureFrame:
        w3cV2SdJwtFormat?.disclosureFrame ??
        disclosureFrameFromClaimPaths(credentialOffer.selectivelyDisclosableClaims),
    })

    const credentialIssue: W3cV2SdJwtCredential = {
      credential: verifiableCredential.encoded as string,
    }

    const format = new DidCommCredentialFormatSpec({
      attachmentId,
      format: W3C_V2_SD_JWT_CREDENTIAL,
    })

    const attachment = getFormatDataAttachment(credentialIssue, format.attachmentId)

    return { format, attachment }
  }

  public async processCredential(
    agentContext: AgentContext,
    {
      credentialExchangeRecord,
      attachment,
      offerAttachment,
      requestAttachment,
      requestAppendAttachments,
    }: DidCommCredentialFormatProcessCredentialOptions
  ): Promise<void> {
    const w3cV2CredentialService = agentContext.dependencyManager.resolve(W3cV2CredentialService)

    const { credential: compactSdJwt } = attachment.getDataAsJson<W3cV2SdJwtCredential>()
    if (!compactSdJwt) throw new CredoError('Missing credential in credential attachment')

    // Parse and validate
    const verifiableCredential = W3cV2SdJwtVerifiableCredential.fromCompact(compactSdJwt)

    // Verify signature
    const result = await w3cV2CredentialService.verifyCredential(agentContext, {
      credential: verifiableCredential,
    })
    if (!result.isValid) {
      throw new CredoError(`Failed to verify W3C VCDM 2.0 SD-JWT credential: ${result.error}`)
    }

    // Validate credential matches offer
    const credentialOffer = JsonTransformer.fromJSON(offerAttachment.getDataAsJson(), W3cV2SdJwtCredentialOffer)
    this.verifyCredentialMatchesOffer(verifiableCredential, credentialOffer)
    this.verifyCredentialBinding(verifiableCredential, requestAttachment, requestAppendAttachments)

    // Store credential
    const record = await w3cV2CredentialService.storeCredential(agentContext, {
      record: W3cV2CredentialRecord.fromCredential(verifiableCredential),
    })

    credentialExchangeRecord.credentials.push({
      credentialRecordType: this.credentialRecordType,
      credentialRecordId: record.id,
    })
  }

  private verifyCredentialMatchesOffer(
    credential: W3cV2SdJwtVerifiableCredential,
    offer: W3cV2SdJwtCredentialOffer
  ): void {
    const offeredCredentialJson = offer.credential
    const receivedCredentialJson = Object.fromEntries(
      Object.entries(JsonTransformer.toJSON(credential.resolvedCredential) as JsonObject).filter(
        ([claim]) => !NON_CREDENTIAL_CLAIMS.includes(claim)
      )
    )

    assertCredentialSubjectMatchesOffer(
      offeredCredentialJson.credentialSubject as SingleOrArray<JsonObject>,
      receivedCredentialJson.credentialSubject as SingleOrArray<JsonObject>
    )

    // Substitute only what the RFC allows an issuer to supply at time of issuance. Everything else, such
    // as `type`, `validUntil` and `credentialSchema`, must be exactly what was offered.
    const expectedReceivedCredential = {
      ...offeredCredentialJson,
      issuer: offeredCredentialJson.issuer ?? receivedCredentialJson.issuer,
      validFrom: offeredCredentialJson.validFrom ?? receivedCredentialJson.validFrom,
      credentialSubject: receivedCredentialJson.credentialSubject,
      ...(offeredCredentialJson.credentialStatus && { credentialStatus: receivedCredentialJson.credentialStatus }),
    }

    if (!deepEquality(receivedCredentialJson, expectedReceivedCredential)) {
      throw new CredoError('Received invalid credential. Received credential does not match the offered credential.')
    }

    // Claims the issuer said would be selectively disclosable resolve once the disclosures are applied,
    // but not in the signed payload, where an object property is removed and an array element is
    // replaced by a digest.
    for (const claimPath of offer.selectivelyDisclosableClaims ?? []) {
      if (!resolveClaimPath(credential.sdJwt.prettyClaims, claimPath).found) {
        throw new CredoError(`Received credential is missing claim '${claimPath}' offered as selectively disclosable.`)
      }

      const inPayload = resolveClaimPath(credential.sdJwt.payload, claimPath)
      if (inPayload.found && !isArrayElementDisclosureDigest(inPayload.value)) {
        throw new CredoError(`Claim '${claimPath}' was offered as selectively disclosable, but is not disclosable.`)
      }
    }

    // Verify binding (cnf) if binding was required
    if (offer.bindingRequired && !credential.sdJwt.prettyClaims.cnf) {
      throw new CredoError('Credential is missing cnf claim but binding was required')
    }
  }

  private verifyCredentialBinding(
    credential: W3cV2SdJwtVerifiableCredential,
    requestAttachment: DidCommAttachment,
    requestAppendAttachments?: DidCommAttachment[]
  ): void {
    const bindingProof =
      requestAttachment.getDataAsJson<W3cV2SdJwtCredentialRequest>().binding_proof?.didcomm_signed_attachment
    if (!bindingProof) return

    const jws = requestAppendAttachments?.find(({ id }) => id === bindingProof.attachment_id)?.data.jws as
      | JwsDetachedFormat
      | undefined
    if (!jws) throw new CredoError('Missing binding proof attachment')
    const { kid } = JsonEncoder.fromBase64Url(jws.protected)

    const { cnf } = credential.sdJwt.payload
    if (!isJsonObject(cnf) || Object.keys(cnf).length !== 1 || typeof kid !== 'string' || cnf.kid !== kid) {
      throw new CredoError("The credential must have a 'cnf' claim with only the 'kid' of the binding proof")
    }
  }

  private async verifyBindingProof(
    agentContext: AgentContext,
    credentialOffer: W3cV2SdJwtCredentialOffer,
    credentialRequest: W3cV2SdJwtCredentialRequest,
    requestAppendAttachments?: DidCommAttachment[]
  ): Promise<SdJwtVcHolderBinding | undefined> {
    const bindingProof = credentialRequest.binding_proof?.didcomm_signed_attachment
    if (!bindingProof) {
      if (credentialOffer.bindingRequired) throw new CredoError('Binding is required but no binding proof was provided')
      return undefined
    }

    const bindingMethod = credentialOffer.bindingMethod?.didcommSignedAttachment
    if (!bindingMethod) throw new CredoError('Cannot issue credential with a binding method that was not offered')

    const signedAttachment = requestAppendAttachments?.find(({ id }) => id === bindingProof.attachment_id)
    if (!signedAttachment) throw new CredoError('Missing binding proof attachment')

    const { nonce, kid, publicJwk } = await verifyDidCommSignedAttachment(agentContext, signedAttachment, {
      algsSupported: bindingMethod.algsSupported,
      allowedPurposes: ['authentication'],
      didMethodsSupported: bindingMethod.didMethodsSupported,
      // Applies the RFC 0881 `jwk` header rules even when the offer has no `jwk_supported`
      jwkSupported: true,
    })
    if (nonce !== bindingMethod.nonce) throw new CredoError('Invalid nonce in signed attachment')
    if (!kid && !bindingMethod.jwkSupported) throw new CredoError("The offer does not accept a 'jwk' binding proof")

    return kid ? { method: 'did', didUrl: kid } : { method: 'jwk', jwk: publicJwk }
  }

  public supportsFormat(format: string): boolean {
    return [W3C_V2_SD_JWT_OFFER, W3C_V2_SD_JWT_REQUEST, W3C_V2_SD_JWT_CREDENTIAL].includes(format)
  }

  public async deleteCredentialById(agentContext: AgentContext, credentialRecordId: string): Promise<void> {
    const w3cV2CredentialService = agentContext.dependencyManager.resolve(W3cV2CredentialService)
    await w3cV2CredentialService.removeCredentialRecord(agentContext, credentialRecordId)
  }

  public async shouldAutoRespondToProposal(
    _agentContext: AgentContext,
    _options: DidCommCredentialFormatAutoRespondProposalOptions
  ): Promise<boolean> {
    throw new CredoError('Proposal is not supported for W3C VCDM 2.0 SD-JWT credential format')
  }

  public async shouldAutoRespondToOffer(
    _agentContext: AgentContext,
    { offerAttachment }: DidCommCredentialFormatAutoRespondOfferOptions
  ): Promise<boolean> {
    const credentialOffer = JsonTransformer.fromJSON(offerAttachment.getDataAsJson(), W3cV2SdJwtCredentialOffer)
    return !credentialOffer.bindingRequired
  }

  public async shouldAutoRespondToRequest(
    _agentContext: AgentContext,
    { offerAttachment, requestAttachment }: DidCommCredentialFormatAutoRespondRequestOptions
  ): Promise<boolean> {
    const credentialOffer = JsonTransformer.fromJSON(offerAttachment.getDataAsJson(), W3cV2SdJwtCredentialOffer)
    const credentialRequest = requestAttachment.getDataAsJson<W3cV2SdJwtCredentialRequest>()

    if (!credentialOffer.bindingRequired && !credentialRequest.binding_proof?.didcomm_signed_attachment) {
      return true
    }

    if (credentialOffer.bindingRequired && !credentialRequest.binding_proof?.didcomm_signed_attachment) {
      return false
    }

    // If binding was provided and offered, can auto-respond
    return Boolean(
      credentialRequest.binding_proof?.didcomm_signed_attachment &&
        credentialOffer.bindingMethod?.didcommSignedAttachment
    )
  }

  public async shouldAutoRespondToCredential(
    _agentContext: AgentContext,
    _options: DidCommCredentialFormatAutoRespondCredentialOptions
  ): Promise<boolean> {
    return true
  }
}
