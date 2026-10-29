import type {
  AgentContext,
  DcqlCredentialsForRequest,
  DcqlPresentation,
  DcqlQuery,
  DcqlQueryResult,
  DidPurpose,
  JsonObject,
  JsonValue,
  SdJwtVc,
} from '@credo-ts/core'
import {
  asArray,
  CredoError,
  DcqlService,
  DidsApi,
  deepEquality,
  getPublicJwkFromVerificationMethod,
  isJsonObject,
  isNonEmptyArray,
  JsonEncoder,
  Kms,
  parseDid,
  SdJwtVcApi,
  TrustedIssuerContext,
  TypedArrayEncoder,
  W3cV2CredentialService,
  W3cV2EnvelopedVerifiableCredential,
  W3cV2SdJwtVerifiableCredential,
  W3cV2SdJwtVerifiablePresentation,
} from '@credo-ts/core'
import { DidCommAttachment, DidCommAttachmentData } from '../../../../decorators/attachment/DidCommAttachment'
import { DidCommConnectionService } from '../../../connections'
import { DidCommProofFormatSpec } from '../../models'
import type { DidCommProofExchangeRecord } from '../../repository'
import type { DidCommProofFormatService } from '../DidCommProofFormatService'
import type {
  DidCommFormatCreateRequestOptions,
  DidCommProofFormatAcceptProposalOptions,
  DidCommProofFormatAcceptRequestOptions,
  DidCommProofFormatAutoRespondPresentationOptions,
  DidCommProofFormatAutoRespondProposalOptions,
  DidCommProofFormatAutoRespondRequestOptions,
  DidCommProofFormatCreateProposalOptions,
  DidCommProofFormatCreateReturn,
  DidCommProofFormatGetCredentialsForRequestOptions,
  DidCommProofFormatProcessOptions,
  DidCommProofFormatProcessPresentationOptions,
  DidCommProofFormatSelectCredentialsForRequestOptions,
} from '../DidCommProofFormatServiceOptions'
import type {
  DcqlPresentationAttachment,
  DcqlProposalAttachment,
  DcqlRequestAttachment,
  DidCommDcqlProofFormat,
} from './DidCommDcqlProofFormat'

const DCQL_REQUEST = 'didcomm/dcql-request@v1.0'
const DCQL_PRESENTATION = 'didcomm/dcql-presentation@v1.0'

const AUDIENCE_PREFIX = 'didcomm:'
const NONCE_PATTERN = /^[A-Za-z0-9\-._~]+$/
const MAX_PRESENTATION_AGE_SECONDS = 300

const SUPPORTED_CREDENTIAL_FORMATS = ['dc+sd-jwt', 'vc+sd-jwt']
const NON_SELECTIVELY_DISCLOSABLE_CREDENTIAL_CLAIMS = [
  '@context',
  'type',
  'issuer',
  'validFrom',
  'validUntil',
  'credentialStatus',
  'credentialSchema',
  'relatedResource',
  'cnf',
]
const NON_SELECTIVELY_DISCLOSABLE_PRESENTATION_CLAIMS = ['nonce', 'aud', 'iat']

type ParsedDcqlQuery = ReturnType<DcqlService['validateDcqlQuery']>
type DcqlCredentialQuery = ParsedDcqlQuery['credentials'][number]
type ParsedDcqlRequest = Omit<DcqlRequestAttachment, 'dcql_query'> & { dcql_query: ParsedDcqlQuery }

export class DidCommDcqlProofFormatService implements DidCommProofFormatService<DidCommDcqlProofFormat> {
  public readonly formatKey = 'dcql' as const

  public supportsFormat(formatIdentifier: string): boolean {
    return formatIdentifier === DCQL_REQUEST || formatIdentifier === DCQL_PRESENTATION
  }

  public async createProposal(
    agentContext: AgentContext,
    { proofFormats, attachmentId }: DidCommProofFormatCreateProposalOptions<DidCommDcqlProofFormat>
  ): Promise<DidCommProofFormatCreateReturn> {
    const dcqlFormat = proofFormats.dcql
    if (!dcqlFormat) {
      throw new CredoError('Missing DCQL format in create proposal attachment format')
    }

    this.validateDcqlQuery(agentContext, dcqlFormat.dcqlQuery)

    const format = new DidCommProofFormatSpec({ format: DCQL_REQUEST, attachmentId })
    const proposal: DcqlProposalAttachment = { dcql_query: dcqlFormat.dcqlQuery }

    return { format, attachment: this.getFormatData(proposal, format.attachmentId) }
  }

  public async processProposal(
    agentContext: AgentContext,
    { attachment }: DidCommProofFormatProcessOptions
  ): Promise<void> {
    const proposal = attachment.getDataAsJson<unknown>()
    if (!isJsonObject(proposal)) {
      throw new CredoError('DCQL proposal attachment must be a JSON object')
    }
    if ('nonce' in proposal || 'audience' in proposal) {
      throw new CredoError("DCQL proposal attachment must not have a 'nonce' or an 'audience'")
    }

    this.validateDcqlQuery(agentContext, proposal.dcql_query)
  }

  public async acceptProposal(
    agentContext: AgentContext,
    {
      proofRecord,
      proofFormats,
      proposalAttachment,
      attachmentId,
    }: DidCommProofFormatAcceptProposalOptions<DidCommDcqlProofFormat>
  ): Promise<DidCommProofFormatCreateReturn> {
    const proposal = proposalAttachment.getDataAsJson<DcqlProposalAttachment>()

    return this.createRequestAttachment(
      agentContext,
      proofRecord,
      proofFormats?.dcql?.dcqlQuery ?? proposal.dcql_query,
      attachmentId
    )
  }

  public async createRequest(
    agentContext: AgentContext,
    { proofRecord, proofFormats, attachmentId }: DidCommFormatCreateRequestOptions<DidCommDcqlProofFormat>
  ): Promise<DidCommProofFormatCreateReturn> {
    const dcqlFormat = proofFormats.dcql
    if (!dcqlFormat) {
      throw new CredoError('Missing DCQL format in create request attachment format')
    }

    return this.createRequestAttachment(agentContext, proofRecord, dcqlFormat.dcqlQuery, attachmentId)
  }

  public async processRequest(
    agentContext: AgentContext,
    { attachment }: DidCommProofFormatProcessOptions
  ): Promise<void> {
    this.parseRequest(agentContext, attachment)
  }

  public async acceptRequest(
    agentContext: AgentContext,
    {
      proofRecord,
      proofFormats,
      requestAttachment,
      attachmentId,
    }: DidCommProofFormatAcceptRequestOptions<DidCommDcqlProofFormat>
  ): Promise<DidCommProofFormatCreateReturn> {
    const request = this.parseRequest(agentContext, requestAttachment)
    await this.assertAudienceIsConnectionDid(agentContext, proofRecord, request.audience)

    const dcqlService = agentContext.resolve(DcqlService)
    const credentials =
      proofFormats?.dcql?.credentials ??
      dcqlService.selectCredentialsForRequest(
        await dcqlService.getCredentialsForRequest(agentContext, request.dcql_query)
      )

    for (const credentialQueryId of Object.keys(credentials)) {
      const credentialQuery = request.dcql_query.credentials.find(({ id }) => id === credentialQueryId)
      if (!credentialQuery || !SUPPORTED_CREDENTIAL_FORMATS.includes(credentialQuery.format)) {
        throw new CredoError(`Presenting for Credential Query '${credentialQueryId}' is not supported`)
      }
    }

    const { encodedDcqlPresentation } = await dcqlService.createPresentation(agentContext, {
      credentialQueryToCredential: credentials,
      challenge: request.nonce,
      domain: request.audience,
    })

    const format = new DidCommProofFormatSpec({ format: DCQL_PRESENTATION, attachmentId })
    const presentation = { vp_token: encodedDcqlPresentation } as DcqlPresentationAttachment

    return { format, attachment: this.getFormatData(presentation, format.attachmentId) }
  }

  public async processPresentation(
    agentContext: AgentContext,
    { requestAttachment, attachment }: DidCommProofFormatProcessPresentationOptions
  ): Promise<boolean> {
    const request = this.parseRequest(agentContext, requestAttachment)
    const { vp_token: vpToken } = attachment.getDataAsJson<Partial<DcqlPresentationAttachment>>()
    if (!isJsonObject(vpToken)) {
      throw new CredoError("DCQL presentation attachment must have a 'vp_token' object")
    }

    const entriesByQuery = Object.entries(vpToken).map(([credentialQueryId, entries]) => {
      const credentialQuery = request.dcql_query.credentials.find(({ id }) => id === credentialQueryId)
      if (!credentialQuery) {
        throw new CredoError(`vp_token has an entry for '${credentialQueryId}', which is not a Credential Query`)
      }
      if (
        !Array.isArray(entries) ||
        entries.length === 0 ||
        (entries.length > 1 && credentialQuery.multiple !== true)
      ) {
        throw new CredoError(`vp_token entry for '${credentialQueryId}' has an invalid number of presentations`)
      }

      for (const entry of entries) {
        const { nonce, aud } = this.decodeNonceAndAudience(credentialQuery, entry)
        if ((nonce !== undefined && nonce !== request.nonce) || (aud !== undefined && aud !== request.audience)) {
          throw new CredoError(`vp_token entry for '${credentialQueryId}' has a wrong 'nonce' or 'aud'`)
        }
      }

      return { credentialQuery, entries }
    })

    const presentations: DcqlPresentation = {}
    const discarded: string[] = []
    for (const { credentialQuery, entries } of entriesByQuery) {
      const verified: Array<SdJwtVc | W3cV2SdJwtVerifiablePresentation> = []
      for (const entry of entries) {
        try {
          verified.push(await this.verifyPresentation(agentContext, credentialQuery, entry, request))
        } catch (error) {
          discarded.push(`${credentialQuery.id}: ${error.message}`)
        }
      }
      if (isNonEmptyArray(verified)) presentations[credentialQuery.id] = verified
    }

    try {
      await agentContext
        .resolve(DcqlService)
        .assertValidDcqlPresentation(agentContext, presentations, request.dcql_query)
    } catch (error) {
      throw new CredoError(`${error.message} Discarded presentations: ${discarded.join('; ') || 'none'}`, {
        cause: error,
      })
    }

    return true
  }

  public async getCredentialsForRequest(
    agentContext: AgentContext,
    { requestAttachment }: DidCommProofFormatGetCredentialsForRequestOptions<DidCommDcqlProofFormat>
  ): Promise<DcqlQueryResult> {
    const request = this.parseRequest(agentContext, requestAttachment)

    return agentContext.resolve(DcqlService).getCredentialsForRequest(agentContext, request.dcql_query)
  }

  public async selectCredentialsForRequest(
    agentContext: AgentContext,
    { requestAttachment }: DidCommProofFormatSelectCredentialsForRequestOptions<DidCommDcqlProofFormat>
  ): Promise<{ credentials: DcqlCredentialsForRequest }> {
    const dcqlService = agentContext.resolve(DcqlService)
    const request = this.parseRequest(agentContext, requestAttachment)
    const queryResult = await dcqlService.getCredentialsForRequest(agentContext, request.dcql_query)

    return { credentials: dcqlService.selectCredentialsForRequest(queryResult) }
  }

  public async shouldAutoRespondToProposal(
    _agentContext: AgentContext,
    { proposalAttachment, requestAttachment }: DidCommProofFormatAutoRespondProposalOptions
  ): Promise<boolean> {
    const proposal = proposalAttachment.getDataAsJson<DcqlProposalAttachment>()
    const request = requestAttachment.getDataAsJson<DcqlRequestAttachment>()

    return deepEquality(request.dcql_query, proposal.dcql_query)
  }

  public async shouldAutoRespondToRequest(
    _agentContext: AgentContext,
    { proposalAttachment, requestAttachment }: DidCommProofFormatAutoRespondRequestOptions
  ): Promise<boolean> {
    const proposal = proposalAttachment.getDataAsJson<DcqlProposalAttachment>()
    const request = requestAttachment.getDataAsJson<DcqlRequestAttachment>()

    return deepEquality(request.dcql_query, proposal.dcql_query)
  }

  public async shouldAutoRespondToPresentation(
    _agentContext: AgentContext,
    _options: DidCommProofFormatAutoRespondPresentationOptions
  ): Promise<boolean> {
    return true
  }

  private async createRequestAttachment(
    agentContext: AgentContext,
    proofRecord: DidCommProofExchangeRecord,
    dcqlQuery: DcqlQuery,
    attachmentId?: string
  ): Promise<DidCommProofFormatCreateReturn> {
    this.validateDcqlQuery(agentContext, dcqlQuery)

    if (!proofRecord.connectionId) {
      throw new CredoError('DCQL requests are only supported over a connection')
    }

    const connection = await agentContext
      .resolve(DidCommConnectionService)
      .getById(agentContext, proofRecord.connectionId)
    if (!connection.did) {
      throw new CredoError(`Connection '${connection.id}' has no DID to use as the audience`)
    }

    const kms = agentContext.resolve(Kms.KeyManagementApi)
    const format = new DidCommProofFormatSpec({ format: DCQL_REQUEST, attachmentId })
    const request: DcqlRequestAttachment = {
      dcql_query: dcqlQuery,
      nonce: TypedArrayEncoder.toBase64Url(kms.randomBytes({ length: 32 })),
      audience: `${AUDIENCE_PREFIX}${connection.did}`,
    }

    return { format, attachment: this.getFormatData(request, format.attachmentId) }
  }

  private parseRequest(agentContext: AgentContext, attachment: DidCommAttachment): ParsedDcqlRequest {
    const request = attachment.getDataAsJson<unknown>()
    if (!isJsonObject(request)) {
      throw new CredoError('DCQL request attachment must be a JSON object')
    }

    const { nonce, audience } = request
    if ('transaction_data' in request) {
      throw new CredoError("DCQL request attachment must not have 'transaction_data'")
    }
    if (typeof nonce !== 'string' || !NONCE_PATTERN.test(nonce)) {
      throw new CredoError("DCQL request attachment must have a 'nonce' of URL safe characters")
    }

    if (typeof audience !== 'string' || !audience.startsWith(AUDIENCE_PREFIX)) {
      throw new CredoError(`DCQL request attachment must have an 'audience' that starts with '${AUDIENCE_PREFIX}'`)
    }

    const audienceDid = audience.slice(AUDIENCE_PREFIX.length)
    if (parseDid(audienceDid).did !== audienceDid) {
      throw new CredoError("DCQL request 'audience' must be a DID without a path, query or fragment")
    }

    return { dcql_query: this.validateDcqlQuery(agentContext, request.dcql_query), nonce, audience }
  }

  private validateDcqlQuery(agentContext: AgentContext, dcqlQuery: unknown): ParsedDcqlQuery {
    const parsed = agentContext.resolve(DcqlService).validateDcqlQuery(dcqlQuery)

    for (const credentialQuery of (dcqlQuery as { credentials: Array<Record<string, unknown>> }).credentials) {
      const { id, format, meta } = credentialQuery
      if (!isJsonObject(meta)) {
        throw new CredoError(`Credential Query '${id}' must have 'meta'`)
      }
      if (format === 'dc+sd-jwt' && !Array.isArray(meta.vct_values)) {
        throw new CredoError(`Credential Query '${id}' with format 'dc+sd-jwt' must have 'meta.vct_values'`)
      }
      if (format === 'vc+sd-jwt' && (!Array.isArray(meta.type_values) || 'vct_values' in meta)) {
        throw new CredoError(
          `Credential Query '${id}' with format 'vc+sd-jwt' must have 'meta.type_values' and no 'meta.vct_values'`
        )
      }
      if (format === 'mso_mdoc' && typeof meta.doctype_value !== 'string') {
        throw new CredoError(`Credential Query '${id}' with format 'mso_mdoc' must have 'meta.doctype_value'`)
      }
    }

    return parsed
  }

  private async assertAudienceIsConnectionDid(
    agentContext: AgentContext,
    proofRecord: DidCommProofExchangeRecord,
    audience: string
  ): Promise<void> {
    if (!proofRecord.connectionId) {
      throw new CredoError('DCQL requests are only supported over a connection')
    }

    const connection = await agentContext
      .resolve(DidCommConnectionService)
      .getById(agentContext, proofRecord.connectionId)
    if (!connection.theirDid || audience !== `${AUDIENCE_PREFIX}${connection.theirDid}`) {
      throw new CredoError(
        `DCQL request audience '${audience}' does not match the DID of connection '${connection.id}' (${connection.theirDid})`
      )
    }
  }

  private decodeNonceAndAudience(credentialQuery: DcqlCredentialQuery, presentation: unknown): JsonObject {
    if (typeof presentation !== 'string') return {}

    const parts = presentation.split('~')
    const jwt = credentialQuery.format === 'dc+sd-jwt' ? parts[parts.length - 1] : parts[0]
    try {
      const payload = JsonEncoder.fromBase64Url(jwt.split('.')[1])
      return isJsonObject(payload) ? payload : {}
    } catch {
      return {}
    }
  }

  private async verifyPresentation(
    agentContext: AgentContext,
    credentialQuery: DcqlCredentialQuery,
    presentation: unknown,
    request: ParsedDcqlRequest
  ): Promise<SdJwtVc | W3cV2SdJwtVerifiablePresentation> {
    if (typeof presentation !== 'string') {
      throw new CredoError(`Presentation for Credential Query '${credentialQuery.id}' must be a string`)
    }

    if (credentialQuery.format === 'dc+sd-jwt') {
      return this.verifySdJwtDc(agentContext, credentialQuery, presentation, request)
    }
    if (credentialQuery.format === 'vc+sd-jwt') {
      return this.verifyW3cV2SdJwt(agentContext, credentialQuery, presentation, request)
    }

    throw new CredoError(`Credential Query format '${credentialQuery.format}' is not supported`)
  }

  private async verifySdJwtDc(
    agentContext: AgentContext,
    credentialQuery: DcqlCredentialQuery,
    presentation: string,
    request: ParsedDcqlRequest
  ): Promise<SdJwtVc> {
    const sdJwtVcApi = agentContext.resolve(SdJwtVcApi)
    const sdJwtVc = sdJwtVcApi.fromCompact(presentation)
    if (sdJwtVc.header.typ !== 'dc+sd-jwt') {
      throw new CredoError("dc+sd-jwt presentation must have header 'typ' 'dc+sd-jwt'")
    }
    if (typeof sdJwtVc.payload.iss === 'string' && sdJwtVc.payload.iss.startsWith('did:') && sdJwtVc.header.x5c) {
      throw new CredoError("dc+sd-jwt with a DID 'iss' must not have an 'x5c' header")
    }

    const requireHolderBinding = credentialQuery.require_cryptographic_holder_binding !== false
    const result = await sdJwtVcApi.verify({
      compactSdJwtVc: presentation,
      keyBinding:
        requireHolderBinding || sdJwtVc.kbJwt ? { audience: request.audience, nonce: request.nonce } : undefined,
    })
    if (!result.isValid) {
      throw new CredoError(`dc+sd-jwt presentation is invalid: ${result.error.message}`, { cause: result.error })
    }

    if (result.sdJwtVc.kbJwt) {
      this.assertFreshIssuedAt(agentContext, result.sdJwtVc.kbJwt.payload.iat)
      await this.resolveCnfKey(agentContext, result.sdJwtVc.payload.cnf)
    }

    return result.sdJwtVc
  }

  private async verifyW3cV2SdJwt(
    agentContext: AgentContext,
    credentialQuery: DcqlCredentialQuery,
    presentation: string,
    request: ParsedDcqlRequest
  ): Promise<W3cV2SdJwtVerifiablePresentation> {
    if (credentialQuery.require_cryptographic_holder_binding === false) {
      throw new CredoError('vc+sd-jwt presentations without holder binding are not supported')
    }

    const verifiablePresentation = W3cV2SdJwtVerifiablePresentation.fromCompact(presentation)
    const { header, payload, prettyClaims, kbJwt } = verifiablePresentation.sdJwt
    if (header.typ !== 'vp+sd-jwt') {
      throw new CredoError("vc+sd-jwt presentation must have header 'typ' 'vp+sd-jwt'")
    }
    if (kbJwt) {
      throw new CredoError('vp+sd-jwt must not have a KB-JWT')
    }
    if ('vc' in prettyClaims || 'vp' in prettyClaims) {
      throw new CredoError("vp+sd-jwt must not have the claims 'vc' or 'vp'")
    }
    for (const claim of NON_SELECTIVELY_DISCLOSABLE_PRESENTATION_CLAIMS) {
      if (claim in prettyClaims && !(claim in payload)) {
        throw new CredoError(`vp+sd-jwt claim '${claim}' must not be selectively disclosable`)
      }
    }
    if (payload.nonce !== request.nonce || payload.aud !== request.audience) {
      throw new CredoError("vp+sd-jwt 'nonce' or 'aud' does not match the request")
    }

    const entries = asArray(verifiablePresentation.resolvedPresentation.verifiableCredential)
    const entry = entries[0]
    if (entries.length !== 1 || !(entry instanceof W3cV2EnvelopedVerifiableCredential)) {
      throw new CredoError('vp+sd-jwt must hold exactly one EnvelopedVerifiableCredential')
    }

    const credential = entry.envelopedCredential
    if (!(credential instanceof W3cV2SdJwtVerifiableCredential)) {
      throw new CredoError('vp+sd-jwt must envelope a vc+sd-jwt credential')
    }
    if (credential.sdJwt.header.typ !== undefined && credential.sdJwt.header.typ !== 'vc+sd-jwt') {
      throw new CredoError("Enveloped credential header 'typ' must be 'vc+sd-jwt'")
    }
    if (credential.sdJwt.kbJwt) {
      throw new CredoError('Enveloped credential must not have a KB-JWT')
    }
    for (const claim of NON_SELECTIVELY_DISCLOSABLE_CREDENTIAL_CLAIMS) {
      if (
        claim in credential.sdJwt.prettyClaims &&
        (!(claim in credential.sdJwt.payload) || hasSdDigests(credential.sdJwt.payload[claim]))
      ) {
        throw new CredoError(`Enveloped credential claim '${claim}' must not be selectively disclosable`)
      }
    }

    await TrustedIssuerContext.ensureTrustedSigner(agentContext, {
      signer: { method: 'did', didUrl: credential.resolvedCredential.issuerId },
      verification: { type: 'credential', credential },
    })

    await this.assertSignedWithCnfKey(agentContext, verifiablePresentation, credential)

    const result = await agentContext.resolve(W3cV2CredentialService).verifyPresentation(agentContext, {
      presentation: verifiablePresentation,
      challenge: request.nonce,
      domain: request.audience,
    })
    if (!result.isValid) {
      const failed = [result.presentation, ...result.credentialEntries].flatMap(({ validations }) =>
        Object.entries(validations)
          .filter(([, validation]) => validation && !validation.isValid)
          .map(([name, validation]) => `${name}: ${validation?.error?.message}`)
      )
      throw new CredoError(`vc+sd-jwt presentation is invalid: ${[result.error?.message, ...failed].join(', ')}`, {
        cause: result.error,
      })
    }

    if (payload.iat !== undefined) {
      this.assertFreshIssuedAt(agentContext, payload.iat)
    }

    return verifiablePresentation
  }

  private async assertSignedWithCnfKey(
    agentContext: AgentContext,
    presentation: W3cV2SdJwtVerifiablePresentation,
    credential: W3cV2SdJwtVerifiableCredential
  ): Promise<void> {
    const cnf = credential.sdJwt.payload.cnf
    const cnfKey = await this.resolveCnfKey(agentContext, cnf)

    const { alg, kid } = presentation.sdJwt.header
    if (!Kms.isKnownJwaSignatureAlgorithm(alg) || !cnfKey.supportedSignatureAlgorithms.includes(alg)) {
      throw new CredoError(`vp+sd-jwt 'alg' '${alg}' is not supported by the credential 'cnf' key`)
    }

    const [protectedHeader, jwtPayload, signature] = presentation.encoded.split('~')[0].split('.')
    const { verified } = await agentContext.resolve(Kms.KeyManagementApi).verify({
      key: { publicJwk: cnfKey.toJson() },
      algorithm: alg,
      data: TypedArrayEncoder.fromUtf8String(`${protectedHeader}.${jwtPayload}`),
      signature: TypedArrayEncoder.fromBase64Url(signature),
    })
    if (!verified) {
      throw new CredoError("vp+sd-jwt is not signed with the credential 'cnf' key")
    }

    if (isJsonObject(cnf) && typeof cnf.kid === 'string' && !kid) {
      throw new CredoError("vp+sd-jwt must have a header 'kid' for a credential with 'cnf.kid'")
    }

    const holder = presentation.resolvedPresentation.holderId
    if (kid) {
      const signer = holder ?? presentation.sdJwt.payload.iss
      const kidKey = await this.resolveDidUrlKey(agentContext, kid.startsWith('#') && signer ? `${signer}${kid}` : kid)
      if (!kidKey.equals(cnfKey)) {
        throw new CredoError("vp+sd-jwt 'kid' does not identify the credential 'cnf' key")
      }
    }

    if (holder && isJsonObject(cnf) && typeof cnf.kid === 'string' && parseDid(cnf.kid).did !== holder) {
      throw new CredoError("vp+sd-jwt 'holder' is not the DID of the credential 'cnf.kid'")
    }
  }

  private async resolveCnfKey(agentContext: AgentContext, cnf: unknown): Promise<Kms.PublicJwk> {
    if (isJsonObject(cnf) && isJsonObject(cnf.jwk)) {
      return Kms.PublicJwk.fromUnknown(cnf.jwk)
    }
    if (isJsonObject(cnf) && typeof cnf.kid === 'string' && cnf.kid.startsWith('did:') && cnf.kid.includes('#')) {
      return this.resolveDidUrlKey(agentContext, cnf.kid, ['authentication'])
    }

    throw new CredoError("Credential must have a 'cnf' with a 'jwk' or an absolute DID URL 'kid'")
  }

  private async resolveDidUrlKey(
    agentContext: AgentContext,
    didUrl: string,
    purposes?: DidPurpose[]
  ): Promise<Kms.PublicJwk> {
    const didDocument = await agentContext.resolve(DidsApi).resolveDidDocument(didUrl)

    return getPublicJwkFromVerificationMethod(didDocument.dereferenceKey(didUrl, purposes))
  }

  private assertFreshIssuedAt(agentContext: AgentContext, issuedAt: unknown): void {
    const now = Math.floor(Date.now() / 1000)
    const skew = agentContext.config.validitySkewSeconds
    if (typeof issuedAt !== 'number' || issuedAt > now + skew || issuedAt < now - MAX_PRESENTATION_AGE_SECONDS - skew) {
      throw new CredoError(`Presentation 'iat' ${issuedAt} is outside the accepted window`)
    }
  }

  private getFormatData(data: unknown, id: string): DidCommAttachment {
    return new DidCommAttachment({
      id,
      mimeType: 'application/json',
      data: new DidCommAttachmentData({ json: data as JsonValue }),
    })
  }
}

function hasSdDigests(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasSdDigests)
  if (!isJsonObject(value)) return false

  return '_sd' in value || '...' in value || Object.values(value).some(hasSdDigests)
}
