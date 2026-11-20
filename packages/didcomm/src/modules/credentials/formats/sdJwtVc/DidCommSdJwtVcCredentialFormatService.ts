import type { AgentContext, SdJwtVcHolderBinding } from '@credo-ts/core'
import {
  CredoError,
  deepEquality,
  isJsonObject,
  JsonTransformer,
  SdJwtVcApi,
  SdJwtVcRecord,
  tryParseDid,
} from '@credo-ts/core'
import type { DidCommAttachment } from '../../../../decorators/attachment/DidCommAttachment'
import { DidCommCredentialFormatSpec } from '../../models/DidCommCredentialFormatSpec'
import { DidCommCredentialProblemReportReason } from '../../models/DidCommCredentialProblemReportReason'
import { V2CredentialProblemReportError } from '../../protocol/v2/errors'
import type { DidCommCredentialExchangeRecord } from '../../repository/DidCommCredentialExchangeRecord'
import {
  createDidCommSignedAttachment,
  createDidCommSignedAttachmentBindingMethods,
  verifyCnfMatchesDidCommSignedAttachmentBindingProof,
  verifyDidCommSignedAttachmentBindingProof,
} from '../../util/didCommSignedAttachment'
import type { DidCommSignedAttachmentCredentialRequestBindingProof } from '../../util/didCommSignedAttachmentBinding'
import { findSentOfferAttachment, getFormatDataAttachment } from '../../util/formatData'
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
import {
  disclosureFrameFromClaimsPathPointers,
  findNotSelectivelyDisclosable,
  resolveClaimsPathPointer,
  selectClaimsPath,
} from './claimsPathPointer'
import type { DidCommSdJwtVcCredentialFormat } from './DidCommSdJwtVcCredentialFormat'
import { type SdJwtVcCredential, SdJwtVcCredentialOffer, type SdJwtVcCredentialRequest } from './sdJwtVcExchange'

const DC_SD_JWT_OFFER = 'didcomm/dc-sd-jwt-offer@v1.0'
const DC_SD_JWT_REQUEST = 'didcomm/dc-sd-jwt-request@v1.0'
const DC_SD_JWT_CREDENTIAL = 'didcomm/dc-sd-jwt@v1.0'
const DC_SD_JWT_REQUEST_METADATA_KEY = '_sdJwtVc/credentialRequest'
type HolderKmsKey = { kmsKeyId?: string; kmsBackend?: string }

// SD-JWT VC section 2.2.2.3: never selectively disclosable, and neither is anything inside them
const NON_SELECTIVELY_DISCLOSABLE_CLAIMS = ['iss', 'nbf', 'exp', 'cnf', 'vct', 'vct#integrity', 'aka_vcts', 'status']

function hasSdJwtEntries(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasSdJwtEntries)
  if (!isJsonObject(value)) return false

  return Object.entries(value).some(
    ([key, child]) => key === '_sd' || key === '_sd_alg' || key === '...' || hasSdJwtEntries(child)
  )
}

// Token Status List section 6.2, with an `https` uri as RFC 0884 requires
function assertValidStatus(status: unknown, { allowOmittedMembers }: { allowOmittedMembers: boolean }): void {
  if (!isJsonObject(status)) throw new CredoError("'status' must be an object")
  if (Object.keys(status).length === 0) throw new CredoError("'status' must reference at least one status mechanism")

  const statusList = status.status_list
  if (statusList === undefined) return
  if (allowOmittedMembers && isJsonObject(statusList) && Object.keys(statusList).length === 0) return

  if (!isJsonObject(statusList)) throw new CredoError("'status.status_list' must be an object")
  const { idx, uri } = statusList
  if (typeof idx !== 'number' || !Number.isInteger(idx) || idx < 0) {
    throw new CredoError("'status.status_list.idx' must be a non-negative integer")
  }
  if (typeof uri !== 'string' || !uri.startsWith('https://')) {
    throw new CredoError("'status.status_list.uri' must be an https URI")
  }
}

function assertValidOffer(
  offer: SdJwtVcCredentialOffer,
  { allowOmittedStatusMembers }: { allowOmittedStatusMembers: boolean }
): void {
  if (offer.bindingRequired && !offer.bindingMethod?.didcommSignedAttachment) {
    throw new CredoError('Binding is required, but the offer has no binding method')
  }

  const { credential } = offer
  if (typeof credential.vct !== 'string') throw new CredoError("The offered credential must have a string 'vct'")
  if ('cnf' in credential) throw new CredoError("The offered credential must not have a 'cnf' claim")
  if (hasSdJwtEntries(credential)) {
    throw new CredoError("The offered credential must not have '_sd', '_sd_alg' or '...' entries")
  }
  for (const claim of ['iss', 'sub', 'vct#integrity']) {
    if (claim in credential && typeof credential[claim] !== 'string') {
      throw new CredoError(`The offered credential '${claim}' must be a string`)
    }
  }
  for (const claim of ['iat', 'nbf', 'exp']) {
    if (claim in credential && typeof credential[claim] !== 'number') {
      throw new CredoError(`The offered credential '${claim}' must be a number`)
    }
  }
  const akaVcts = credential.aka_vcts
  if (
    'aka_vcts' in credential &&
    (!Array.isArray(akaVcts) ||
      akaVcts.length === 0 ||
      akaVcts.some((vct) => typeof vct !== 'string' || vct === credential.vct))
  ) {
    throw new CredoError(
      "The offered credential 'aka_vcts' must be a non-empty array of strings that does not contain its 'vct'"
    )
  }
  if ('status' in credential) {
    assertValidStatus(credential.status, { allowOmittedMembers: allowOmittedStatusMembers })
  }

  for (const pointer of offer.selectivelyDisclosableClaims ?? []) {
    resolveClaimsPathPointer(credential, pointer)
    if (NON_SELECTIVELY_DISCLOSABLE_CLAIMS.includes(pointer[0] as string)) {
      throw new CredoError(`Claim ${JSON.stringify(pointer)} cannot be selectively disclosable`)
    }
  }
}

// SD-JWT VC section 5.6.4, applied when the Type Metadata of `vct` can be resolved
async function applyTypeMetadataSelectiveDisclosure(
  agentContext: AgentContext,
  offer: SdJwtVcCredentialOffer
): Promise<void> {
  const { credential } = offer
  const { vct, 'vct#integrity': integrity } = credential
  if (typeof vct !== 'string') return
  const typeMetadata = await agentContext.dependencyManager
    .resolve(SdJwtVcApi)
    .fetchTypeMetadata(
      { vct, 'vct#integrity': typeof integrity === 'string' ? integrity : undefined },
      { throwErrorOnFetchError: false, throwErrorOnUnsupportedVctValue: false }
    )

  const pointers = [...(offer.selectivelyDisclosableClaims ?? [])]
  for (const { path, sd } of typeMetadata?.mergedTypeMetadata.claims ?? []) {
    for (const pointer of selectClaimsPath(credential, path)) {
      const offered = pointers.some((offeredPointer) => JSON.stringify(offeredPointer) === JSON.stringify(pointer))
      if (sd === 'never' && offered) {
        throw new CredoError(`Claim ${JSON.stringify(pointer)} is marked sd 'never' in the Type Metadata of 'vct'`)
      }
      if (sd === 'always' && !offered) pointers.push(pointer)
    }
  }

  if (pointers.length > 0) offer.selectivelyDisclosableClaims = pointers
}

function omittedStatusMechanisms(status: unknown): string[] {
  if (!isJsonObject(status)) return []
  return Object.entries(status)
    .filter(([, reference]) => isJsonObject(reference) && Object.keys(reference).length === 0)
    .map(([mechanism]) => mechanism)
}

// RFC 0884 Issuance-time Claims: the only claims that can differ from the offer
function assertClaimsMatchOffer(claims: Record<string, unknown>, offered: Record<string, unknown>): void {
  const { cnf, ...issued } = claims
  const expected: Record<string, unknown> = { ...offered }

  for (const claim of ['iss', 'sub', 'vct#integrity', 'status']) {
    if (!(claim in offered) && claim in issued) expected[claim] = issued[claim]
  }
  for (const claim of ['iat', 'nbf', 'exp']) {
    if (claim in issued) expected[claim] = issued[claim]
  }

  const { status: offeredStatus } = offered
  const { status: issuedStatus } = issued
  if (isJsonObject(offeredStatus) && isJsonObject(issuedStatus)) {
    for (const mechanism of omittedStatusMechanisms(offeredStatus)) {
      if (!isJsonObject(issuedStatus[mechanism]) || Object.keys(issuedStatus[mechanism]).length === 0) {
        throw new CredoError(`The issued 'status.${mechanism}' must have the members the offer left out`)
      }
    }
    expected.status = Object.fromEntries(
      Object.entries(offeredStatus).map(([mechanism, reference]) => [
        mechanism,
        isJsonObject(reference) && Object.keys(reference).length === 0 && mechanism in issuedStatus
          ? issuedStatus[mechanism]
          : reference,
      ])
    )
  }

  if (!deepEquality(issued, expected)) {
    throw new CredoError('The claims of the credential do not match the offered credential')
  }
}

export class DidCommSdJwtVcCredentialFormatService
  implements DidCommCredentialFormatService<DidCommSdJwtVcCredentialFormat>
{
  public readonly formatKey = 'sdJwtVc' as const
  public readonly credentialRecordType = 'sd-jwt-vc' as const
  private hasLoggedExperimentalWarning = false

  public async createProposal(
    _agentContext: AgentContext,
    _options: DidCommCredentialFormatCreateProposalOptions<DidCommSdJwtVcCredentialFormat>
  ): Promise<DidCommCredentialFormatCreateProposalReturn> {
    throw new CredoError('Proposal is not supported for the dc+sd-jwt credential format')
  }

  public async processProposal(
    _agentContext: AgentContext,
    _options: DidCommCredentialFormatProcessOptions
  ): Promise<void> {
    throw new CredoError('Proposal is not supported for the dc+sd-jwt credential format')
  }

  public async acceptProposal(
    _agentContext: AgentContext,
    _options: DidCommCredentialFormatAcceptProposalOptions<DidCommSdJwtVcCredentialFormat>
  ): Promise<DidCommCredentialFormatCreateOfferReturn> {
    throw new CredoError('Proposal is not supported for the dc+sd-jwt credential format')
  }

  public async createOffer(
    agentContext: AgentContext,
    { credentialFormats, attachmentId }: DidCommCredentialFormatCreateOfferOptions<DidCommSdJwtVcCredentialFormat>
  ): Promise<DidCommCredentialFormatCreateOfferReturn> {
    this.logExperimentalWarning(agentContext)

    const sdJwtVcFormat = credentialFormats.sdJwtVc
    if (!sdJwtVcFormat) throw new CredoError('Missing sdJwtVc credential format data')

    const { credential, bindingRequired, selectivelyDisclosableClaims, didCommSignedAttachmentBinding } = sdJwtVcFormat

    const bindingMethod =
      didCommSignedAttachmentBinding &&
      createDidCommSignedAttachmentBindingMethods(agentContext, didCommSignedAttachmentBinding)

    const credentialOffer = new SdJwtVcCredentialOffer({
      bindingRequired,
      bindingMethod,
      selectivelyDisclosableClaims,
      credential,
    })
    await applyTypeMetadataSelectiveDisclosure(agentContext, credentialOffer)
    assertValidOffer(credentialOffer, { allowOmittedStatusMembers: true })
    // Credo only issues with DID-based key discovery, and core sets `iss` to the bare DID of the signing key
    if (typeof credential.iss !== 'string' || tryParseDid(credential.iss)?.did !== credential.iss) {
      throw new CredoError("The offered credential must have an 'iss' that is a DID without a path, query or fragment")
    }

    const format = new DidCommCredentialFormatSpec({
      attachmentId,
      format: DC_SD_JWT_OFFER,
    })

    const attachment = getFormatDataAttachment(JsonTransformer.toJSON(credentialOffer), format.attachmentId)
    return { format, attachment }
  }

  public async processOffer(
    agentContext: AgentContext,
    { attachment }: DidCommCredentialFormatProcessOptions
  ): Promise<void> {
    try {
      assertValidOffer(this.parseOffer(agentContext, attachment), { allowOmittedStatusMembers: true })
    } catch (error) {
      throw new V2CredentialProblemReportError(error.message, {
        problemCode: DidCommCredentialProblemReportReason.IssuanceAbandoned,
      })
    }
  }

  public async acceptOffer(
    agentContext: AgentContext,
    {
      credentialExchangeRecord,
      offerAttachment,
      attachmentId,
      credentialFormats,
    }: DidCommCredentialFormatAcceptOfferOptions<DidCommSdJwtVcCredentialFormat>
  ): Promise<DidCommCredentialFormatCreateReturn> {
    const credentialOffer = this.parseOffer(agentContext, offerAttachment)

    let signedAttachment: DidCommAttachment | undefined
    let bindingProof: DidCommSignedAttachmentCredentialRequestBindingProof | undefined

    const didCommSignedAttachmentOptions = credentialFormats?.sdJwtVc?.didCommSignedAttachment
    if (didCommSignedAttachmentOptions) {
      const bindingMethod = credentialOffer.bindingMethod?.didcommSignedAttachment
      if (!bindingMethod) {
        throw new CredoError('Cannot request credential with a binding method that was not offered.')
      }
      if (didCommSignedAttachmentOptions.jwk) {
        if (!bindingMethod.jwkSupported) throw new CredoError("The offer does not accept a 'jwk' binding proof")
        credentialExchangeRecord.metadata.set(DC_SD_JWT_REQUEST_METADATA_KEY, {
          kmsKeyId: didCommSignedAttachmentOptions.jwk.keyId,
          kmsBackend: didCommSignedAttachmentOptions.jwk.kmsBackend,
        })
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

    const credentialRequest: SdJwtVcCredentialRequest = {
      binding_proof: bindingProof,
    }

    const format = new DidCommCredentialFormatSpec({
      attachmentId,
      format: DC_SD_JWT_REQUEST,
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
    _options: DidCommCredentialFormatCreateRequestOptions<DidCommSdJwtVcCredentialFormat>
  ): Promise<DidCommCredentialFormatCreateReturn> {
    throw new CredoError('Starting from a request is not supported for the dc+sd-jwt credential format')
  }

  public async processRequest(
    agentContext: AgentContext,
    { credentialExchangeRecord, attachment, requestAppendAttachments }: DidCommCredentialFormatProcessRequestOptions
  ): Promise<void> {
    const offerAttachment = await findSentOfferAttachment(agentContext, credentialExchangeRecord.id, DC_SD_JWT_OFFER)
    if (!offerAttachment) {
      throw new V2CredentialProblemReportError(
        'A dc+sd-jwt credential request must answer a dc+sd-jwt credential offer in the same thread',
        { problemCode: DidCommCredentialProblemReportReason.IssuanceAbandoned }
      )
    }

    try {
      const credentialOffer = this.parseOffer(agentContext, offerAttachment)
      await verifyDidCommSignedAttachmentBindingProof(agentContext, {
        bindingRequired: credentialOffer.bindingRequired,
        bindingMethod: credentialOffer.bindingMethod,
        bindingProof: attachment.getDataAsJson<SdJwtVcCredentialRequest>().binding_proof,
        appendAttachments: requestAppendAttachments,
      })
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
    }: DidCommCredentialFormatAcceptRequestOptions<DidCommSdJwtVcCredentialFormat>
  ): Promise<DidCommCredentialFormatCreateReturn> {
    const sdJwtVcFormat = credentialFormats?.sdJwtVc

    if (!offerAttachment) throw new CredoError('Missing offer attachment')
    const credentialOffer = this.parseOffer(agentContext, offerAttachment)
    const credentialRequest = requestAttachment.getDataAsJson<SdJwtVcCredentialRequest>()

    let holder: SdJwtVcHolderBinding | undefined
    try {
      holder = await verifyDidCommSignedAttachmentBindingProof(agentContext, {
        bindingRequired: credentialOffer.bindingRequired,
        bindingMethod: credentialOffer.bindingMethod,
        bindingProof: credentialRequest.binding_proof,
        appendAttachments: requestAppendAttachments,
      })
    } catch (error) {
      throw new V2CredentialProblemReportError(error.message, {
        problemCode: DidCommCredentialProblemReportReason.IssuanceAbandoned,
      })
    }

    const { iss } = credentialOffer.credential
    if (!iss) throw new CredoError("The offered credential has no 'iss'")

    const { verificationMethod } = await getIssuerVerificationMethod(agentContext, {
      issuerId: iss,
      verificationMethodId: sdJwtVcFormat?.issuerVerificationMethod,
      allowedPurposes: ['assertionMethod'],
    })

    const payload = sdJwtVcFormat?.status
      ? { ...credentialOffer.credential, status: { ...credentialOffer.credential.status, ...sdJwtVcFormat.status } }
      : credentialOffer.credential
    if (payload.status !== undefined) assertValidStatus(payload.status, { allowOmittedMembers: false })
    assertClaimsMatchOffer(payload, credentialOffer.credential)

    const { compact } = await agentContext.dependencyManager.resolve(SdJwtVcApi).sign({
      payload,
      issuer: { method: 'did', didUrl: verificationMethod.id },
      holder,
      disclosureFrame: disclosureFrameFromClaimsPathPointers(credentialOffer.selectivelyDisclosableClaims),
    })

    const credential: SdJwtVcCredential = { credential: compact }

    const format = new DidCommCredentialFormatSpec({
      attachmentId,
      format: DC_SD_JWT_CREDENTIAL,
    })

    const attachment = getFormatDataAttachment(credential, format.attachmentId)
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
    const sdJwtVcApi = agentContext.dependencyManager.resolve(SdJwtVcApi)

    let record: SdJwtVcRecord
    try {
      const credentialOffer = this.parseOffer(agentContext, offerAttachment)

      const { credential } = attachment.getDataAsJson<SdJwtVcCredential>()
      if (typeof credential !== 'string' || !credential.endsWith('~')) {
        throw new CredoError('The credential must be an SD-JWT in compact serialization without a Key Binding JWT')
      }

      const { header, payload } = sdJwtVcApi.fromCompact(credential)
      if (header.typ !== 'dc+sd-jwt') throw new CredoError("The SD-JWT VC header 'typ' must be 'dc+sd-jwt'")
      if (typeof payload.iss === 'string' && payload.iss.startsWith('did:') && header.x5c) {
        throw new CredoError("An SD-JWT VC with a DID 'iss' must not have an 'x5c' header")
      }

      const result = await sdJwtVcApi.verify({ sdJwtVc: credential, disableStatusValidation: true })
      if (!result.isValid) throw new CredoError(`Failed to verify the SD-JWT VC. ${result.error.message}`)

      const { sdJwtVc } = result
      for (const claim of NON_SELECTIVELY_DISCLOSABLE_CLAIMS) {
        if ((claim in sdJwtVc.prettyClaims && !(claim in sdJwtVc.payload)) || hasSdJwtEntries(sdJwtVc.payload[claim])) {
          throw new CredoError(`Claim '${claim}' must not be selectively disclosable`)
        }
      }

      assertClaimsMatchOffer(sdJwtVc.prettyClaims, credentialOffer.credential)

      const notDisclosable = findNotSelectivelyDisclosable(sdJwtVc, credentialOffer.selectivelyDisclosableClaims ?? [])
      if (notDisclosable) {
        throw new CredoError(
          `Claim ${JSON.stringify(notDisclosable)} was offered as selectively disclosable, but is not`
        )
      }

      const holderKey = this.verifyCredentialBinding(
        credentialExchangeRecord,
        sdJwtVc.payload.cnf,
        requestAttachment,
        requestAppendAttachments
      )

      if (sdJwtVc.prettyClaims.status !== undefined) {
        assertValidStatus(sdJwtVc.prettyClaims.status, { allowOmittedMembers: false })
      }

      record = SdJwtVcRecord.fromSdJwtVc({ ...sdJwtVc, ...holderKey })
    } catch (error) {
      throw new V2CredentialProblemReportError(error.message, {
        problemCode: DidCommCredentialProblemReportReason.IssuanceAbandoned,
      })
    }

    await sdJwtVcApi.store({ record })

    credentialExchangeRecord.credentials.push({
      credentialRecordType: this.credentialRecordType,
      credentialRecordId: record.id,
    })
  }

  public supportsFormat(format: string): boolean {
    return [DC_SD_JWT_OFFER, DC_SD_JWT_REQUEST, DC_SD_JWT_CREDENTIAL].includes(format)
  }

  public async deleteCredentialById(agentContext: AgentContext, credentialRecordId: string): Promise<void> {
    await agentContext.dependencyManager.resolve(SdJwtVcApi).deleteById(credentialRecordId)
  }

  public async shouldAutoRespondToProposal(
    _agentContext: AgentContext,
    _options: DidCommCredentialFormatAutoRespondProposalOptions
  ): Promise<boolean> {
    throw new CredoError('Proposal is not supported for the dc+sd-jwt credential format')
  }

  public async shouldAutoRespondToOffer(
    agentContext: AgentContext,
    { offerAttachment }: DidCommCredentialFormatAutoRespondOfferOptions
  ): Promise<boolean> {
    return !this.parseOffer(agentContext, offerAttachment).bindingRequired
  }

  public async shouldAutoRespondToRequest(
    agentContext: AgentContext,
    { offerAttachment, requestAttachment }: DidCommCredentialFormatAutoRespondRequestOptions
  ): Promise<boolean> {
    const credentialOffer = this.parseOffer(agentContext, offerAttachment)
    const credentialRequest = requestAttachment.getDataAsJson<SdJwtVcCredentialRequest>()

    // The issuer application has to fill an omitted status mechanism through acceptRequest
    if (omittedStatusMechanisms(credentialOffer.credential.status).length > 0) return false

    if (!credentialOffer.bindingRequired && !credentialRequest.binding_proof?.didcomm_signed_attachment) {
      return true
    }

    if (credentialOffer.bindingRequired && !credentialRequest.binding_proof?.didcomm_signed_attachment) {
      return false
    }

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

  private parseOffer(agentContext: AgentContext, offerAttachment: DidCommAttachment): SdJwtVcCredentialOffer {
    this.logExperimentalWarning(agentContext)
    return JsonTransformer.fromJSON(offerAttachment.getDataAsJson(), SdJwtVcCredentialOffer)
  }

  private logExperimentalWarning(agentContext: AgentContext): void {
    if (this.hasLoggedExperimentalWarning) return
    this.hasLoggedExperimentalWarning = true
    agentContext.config.logger.warn(
      "The dc+sd-jwt credential format of '@credo-ts/didcomm' is experimental and could have unexpected breaking changes. When using this format, make sure to use strict versions for all @credo-ts packages."
    )
  }

  private verifyCredentialBinding(
    credentialExchangeRecord: DidCommCredentialExchangeRecord,
    cnf: unknown,
    requestAttachment: DidCommAttachment,
    requestAppendAttachments?: DidCommAttachment[]
  ): HolderKmsKey | undefined {
    const bindingProof = requestAttachment.getDataAsJson<SdJwtVcCredentialRequest>().binding_proof
    const proofMethod = verifyCnfMatchesDidCommSignedAttachmentBindingProof(cnf, {
      bindingProof,
      appendAttachments: requestAppendAttachments,
    })
    if (!proofMethod && cnf !== undefined) {
      throw new CredoError("The credential has a 'cnf' claim, but the request has no binding proof")
    }
    if (proofMethod !== 'jwk') return undefined

    return credentialExchangeRecord.metadata.get<HolderKmsKey>(DC_SD_JWT_REQUEST_METADATA_KEY) ?? undefined
  }
}
