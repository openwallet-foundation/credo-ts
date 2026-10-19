import { AgentContext } from '../../agent'
import { injectable } from '../../plugins'
import type { Query, QueryOptions } from '../../storage/StorageService'
import { canUseInstanceFromCredentialRecord } from '../../utils/credentialUse'
import { CredentialMultiInstanceUseMode } from '../../utils/credentialUseTypes'
import { KeyManagementApi } from '../kms'
import { Mdoc } from './Mdoc'
import { MdocDeviceResponse } from './MdocDeviceResponse'
import { MdocError } from './MdocError'
import type {
  MdocDeleteVerificationSessionOptions,
  MdocDeviceResponseDcqlQueryOptions,
  MdocDeviceResponseOptions,
  MdocDeviceResponsePresentationDefinitionOptions,
  MdocDeviceResponseVerifyOptions,
  MdocResolvedRequest,
  MdocSelectCredentialsForRequestOptions,
  MdocSelectedCredentials,
  MdocSignOptions,
  MdocStoreOptions,
  MdocValidCredential,
  MdocVerifyOptions,
} from './MdocOptions'
import {
  MdocRecord,
  MdocRepository,
  type MdocVerificationSessionRecord,
  MdocVerificationSessionRepository,
} from './repository'

/**
 * @internal
 */
@injectable()
export class MdocService {
  private mdocRepository: MdocRepository
  private mdocVerificationSessionRepository: MdocVerificationSessionRepository

  public constructor(
    mdocRepository: MdocRepository,
    mdocVerificationSessionRepository: MdocVerificationSessionRepository
  ) {
    this.mdocRepository = mdocRepository
    this.mdocVerificationSessionRepository = mdocVerificationSessionRepository
  }

  public mdocFromBase64Url(hexEncodedMdoc: string) {
    return Mdoc.fromBase64Url(hexEncodedMdoc)
  }

  public signMdoc(agentContext: AgentContext, options: MdocSignOptions) {
    return Mdoc.sign(agentContext, options)
  }

  public async verifyMdoc(agentContext: AgentContext, mdoc: Mdoc, options: MdocVerifyOptions) {
    return await mdoc.verify(agentContext, options)
  }

  public async createDeviceResponse(agentContext: AgentContext, options: MdocDeviceResponseOptions) {
    return MdocDeviceResponse.createDeviceResponse(agentContext, options)
  }

  public async createPresentationDefinitionDeviceResponse(
    agentContext: AgentContext,
    options: MdocDeviceResponsePresentationDefinitionOptions
  ) {
    return MdocDeviceResponse.createDeviceResponseWithPresentationDefinition(agentContext, options)
  }

  /**
   * @deprecated Credo does not use this method itself, and it only supports part of DCQL. Every claim
   * of every `mso_mdoc` credential query is requested: `credential_sets`, `claim_sets` and `values`
   * are ignored, credential queries with the same doctype are merged, nested claim paths are
   * truncated, and a claim missing from the mdoc throws instead of being treated as optional. Use
   * `DcqlService.createPresentation` to present mdocs for a DCQL query, or
   * {@link MdocService.createDeviceResponse} with explicit `documentRequests`.
   */
  public async createDcqlQueryDeviceResponse(agentContext: AgentContext, options: MdocDeviceResponseDcqlQueryOptions) {
    return MdocDeviceResponse.createDeviceResponseWithDcqlQuery(agentContext, options)
  }

  /**
   * Select the credentials to answer a resolved request with. For a resolved DC API request the
   * result can be passed to `createDcApiResponse` as is. Use this when the wallet does not let the
   * user choose.
   *
   * Every mandatory use case is answered with the first of its matching document sets for which
   * every doc request has a credential that can be used, the same as optional credential sets are
   * left out when selecting for DCQL. Without mandatory use cases, as when the doc requests are
   * treated as alternatives, the first use case that can be answered is. Per doc request the first
   * valid credential is selected, with the first option of each claim: an alternative set when the
   * element itself is not in the mdoc, and the device signed values the request was resolved with.
   */
  public selectCredentialsForRequest<ResolvedRequest extends MdocResolvedRequest>(
    resolvedRequest: ResolvedRequest,
    { useMode = CredentialMultiInstanceUseMode.NewOrFirst }: MdocSelectCredentialsForRequestOptions = {}
  ): MdocSelectedCredentials<ResolvedRequest> {
    if (!resolvedRequest.success) {
      throw new MdocError('Cannot select the credentials for the request if the request cannot be satisfied')
    }

    const selected = new Map<number, MdocValidCredential>()
    const selectDocumentSet = (documentSet: number[]) => {
      const credentials = documentSet.map((docRequestIndex) => {
        const credential =
          selected.get(docRequestIndex) ??
          resolvedRequest.docRequests
            .find((docRequest) => docRequest.docRequestIndex === docRequestIndex)
            ?.validCredentials.find(({ record }) =>
              canUseInstanceFromCredentialRecord({ credentialRecord: record, useMode })
            )

        return credential ? ([docRequestIndex, credential] as const) : undefined
      })

      if (!credentials.every((credential) => credential !== undefined)) return false

      for (const [docRequestIndex, credential] of credentials) selected.set(docRequestIndex, credential)
      return true
    }

    const mandatoryUseCases = resolvedRequest.useCases.filter(({ mandatory }) => mandatory)
    for (const { useCaseIndex, matchingDocumentSets } of mandatoryUseCases) {
      if (!matchingDocumentSets.some(selectDocumentSet)) {
        throw new MdocError(
          `Unable to select credentials for use case ${useCaseIndex}. No new credential instance available on any of the available credentials.`
        )
      }
    }

    if (
      mandatoryUseCases.length === 0 &&
      !resolvedRequest.useCases.some(({ matchingDocumentSets }) => matchingDocumentSets.some(selectDocumentSet))
    ) {
      throw new MdocError(
        'Unable to select credentials for any use case. No new credential instance available on any of the available credentials.'
      )
    }

    return {
      resolvedRequest,
      credentials: Array.from(selected.entries())
        .sort(([a], [b]) => a - b)
        .map(([docRequestIndex, credential]) => ({
          docRequestIndex,
          record: credential.record,
          useMode,
          ...this.getDisclosureForValidCredential(credential),
        })),
    }
  }

  /**
   * The alternative sets and device signed values to disclose a valid credential with, from the first
   * option of each claim.
   */
  private getDisclosureForValidCredential(credential: MdocValidCredential) {
    const alternatives: Record<string, Record<string, number>> = {}
    const deviceNameSpaces: Record<string, Record<string, unknown>> = {}

    for (const claim of credential.claims.validClaims) {
      const [option] = claim.options ?? []
      const disclosedElements = option
        ? option.elements
        : [
            {
              namespace: claim.namespace,
              elementIdentifier: claim.disclosedElementIdentifier,
              elementValue: claim.elementValue,
              source: claim.source,
            },
          ]

      if (option?.alternativeElementSetIndex !== undefined) {
        alternatives[claim.namespace] = {
          ...alternatives[claim.namespace],
          [claim.elementIdentifier]: option.alternativeElementSetIndex,
        }
      }

      for (const { namespace, elementIdentifier, elementValue, source } of disclosedElements) {
        if (source !== 'deviceSigned') continue
        deviceNameSpaces[namespace] = { ...deviceNameSpaces[namespace], [elementIdentifier]: elementValue }
      }
    }

    return {
      alternatives: Object.keys(alternatives).length > 0 ? alternatives : undefined,
      deviceNameSpaces: Object.keys(deviceNameSpaces).length > 0 ? deviceNameSpaces : undefined,
    }
  }

  public async verifyDeviceResponse(agentContext: AgentContext, options: MdocDeviceResponseVerifyOptions) {
    const deviceResponse = MdocDeviceResponse.fromBase64Url(options.deviceResponse)
    return deviceResponse.verify(agentContext, options)
  }

  public async store(agentContext: AgentContext, options: MdocStoreOptions) {
    await this.mdocRepository.save(agentContext, options.record)

    return options.record
  }

  public async getById(agentContext: AgentContext, id: string): Promise<MdocRecord> {
    return await this.mdocRepository.getById(agentContext, id)
  }

  public async getAll(agentContext: AgentContext): Promise<Array<MdocRecord>> {
    return await this.mdocRepository.getAll(agentContext)
  }

  public async findByQuery(
    agentContext: AgentContext,
    query: Query<MdocRecord>,
    queryOptions?: QueryOptions
  ): Promise<Array<MdocRecord>> {
    return await this.mdocRepository.findByQuery(agentContext, query, queryOptions)
  }

  public async deleteById(agentContext: AgentContext, id: string) {
    await this.mdocRepository.deleteById(agentContext, id)
  }

  public async update(agentContext: AgentContext, mdocRecord: MdocRecord) {
    await this.mdocRepository.update(agentContext, mdocRecord)
  }

  public async getVerificationSessionById(
    agentContext: AgentContext,
    verificationSessionId: string
  ): Promise<MdocVerificationSessionRecord> {
    return await this.mdocVerificationSessionRepository.getById(agentContext, verificationSessionId)
  }

  public async findVerificationSessionsByQuery(
    agentContext: AgentContext,
    query: Query<MdocVerificationSessionRecord>,
    queryOptions?: QueryOptions
  ): Promise<Array<MdocVerificationSessionRecord>> {
    return await this.mdocVerificationSessionRepository.findByQuery(agentContext, query, queryOptions)
  }

  /**
   * Delete a verification session, and by default the ephemeral session key it holds. The key is
   * not deleted at any other point in the session lifecycle.
   */
  public async deleteVerificationSessionById(
    agentContext: AgentContext,
    verificationSessionId: string,
    options?: MdocDeleteVerificationSessionOptions
  ) {
    const verificationSession = await this.mdocVerificationSessionRepository.getById(
      agentContext,
      verificationSessionId
    )

    const deleteAssociatedKey = options?.deleteAssociatedKey ?? true
    if (deleteAssociatedKey) {
      const kms = agentContext.resolve(KeyManagementApi)

      // Returns false if the key was already gone, which is the state we want it in
      await kms.deleteKey({ keyId: verificationSession.sessionKeyId })
    }

    await this.mdocVerificationSessionRepository.delete(agentContext, verificationSession)
  }
}
