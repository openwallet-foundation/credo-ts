import type { AgentContext } from '../../agent/context'
import { CredoError } from '../../error'
import { injectable } from '../../plugins'
import type { Query, QueryOptions } from '../../storage/StorageService'
import { mapDataIntegrityIssuesToCredoError, type W3cV2DataIntegrityIssue } from './data-integrity-v1'
import { W3cV2JwtVerifiableCredential, W3cV2JwtVerifiablePresentation } from './jwt-vc'
import { W3cV2JwtCredentialService } from './jwt-vc/W3cV2JwtCredentialService'
import type { W3cV2VerifiableCredential, W3cV2VerifyCredentialResult, W3cV2VerifyPresentationResult } from './models'
import { ClaimFormat } from './models'
import type { W3cV2VerifiablePresentation } from './models/presentation/W3cV2VerifiablePresentation'
import { W3cV2CredentialRecord, W3cV2CredentialRepository } from './repository'
import {
  W3cV2SdJwtCredentialService,
  W3cV2SdJwtVerifiableCredential,
  W3cV2SdJwtVerifiablePresentation,
} from './sd-jwt-vc'
import type {
  W3cV2DiSignCredentialOptions,
  W3cV2DiSignPresentationOptions,
  W3cV2DiVerifyCredentialOptions,
  W3cV2DiVerifyPresentationOptions,
  W3cV2JwtVerifyCredentialOptions,
  W3cV2JwtVerifyPresentationOptions,
  W3cV2SdJwtVerifyCredentialOptions,
  W3cV2SdJwtVerifyPresentationOptions,
  W3cV2SignCredentialOptions,
  W3cV2SignPresentationOptions,
  W3cV2StoreCredentialOptions,
  W3cV2VerifyCredentialOptions,
  W3cV2VerifyPresentationOptions,
} from './W3cV2CredentialServiceOptions'

@injectable()
export class W3cV2CredentialService {
  private w3cV2CredentialRepository: W3cV2CredentialRepository
  private w3cV2SdJwtCredentialService: W3cV2SdJwtCredentialService
  private w3cV2JwtCredentialService: W3cV2JwtCredentialService

  public constructor(
    w3cV2CredentialRepository: W3cV2CredentialRepository,
    w3cV2SdJwtCredentialService: W3cV2SdJwtCredentialService,
    w3cV2JwtCredentialService: W3cV2JwtCredentialService
  ) {
    this.w3cV2CredentialRepository = w3cV2CredentialRepository
    this.w3cV2SdJwtCredentialService = w3cV2SdJwtCredentialService
    this.w3cV2JwtCredentialService = w3cV2JwtCredentialService
  }

  /**
   * Signs a credential
   *
   * @param credential the credential to be signed
   * @returns the signed credential
   */
  public async signCredential<Format extends ClaimFormat.JwtW3cVc | ClaimFormat.SdJwtW3cVc | ClaimFormat.DiVc>(
    agentContext: AgentContext,
    options: W3cV2SignCredentialOptions<Format>
  ): Promise<W3cV2VerifiableCredential<Format>> {
    if (options.format === ClaimFormat.JwtW3cVc) {
      const signed = await this.w3cV2JwtCredentialService.signCredential(agentContext, options)
      return signed as W3cV2VerifiableCredential<Format>
    }
    if (options.format === ClaimFormat.SdJwtW3cVc) {
      const signed = await this.w3cV2SdJwtCredentialService.signCredential(agentContext, options)
      return signed as W3cV2VerifiableCredential<Format>
    }
    if (options.format === ClaimFormat.DiVc) {
      this.throwDataIntegrityStubError('signCredential', ClaimFormat.DiVc, options as W3cV2DiSignCredentialOptions)
    }
    throw new CredoError(`Unsupported format in options. Format must be either 'vc+jwt', 'vc+sd-jwt', or 'di_vc'`)
  }

  /**
   * Verifies the signature(s) of a credential
   */
  public async verifyCredential(
    agentContext: AgentContext,
    options: W3cV2VerifyCredentialOptions
  ): Promise<W3cV2VerifyCredentialResult> {
    if (options.credential instanceof W3cV2JwtVerifiableCredential) {
      return this.w3cV2JwtCredentialService.verifyCredential(agentContext, options as W3cV2JwtVerifyCredentialOptions)
    }
    if (options.credential instanceof W3cV2SdJwtVerifiableCredential) {
      return this.w3cV2SdJwtCredentialService.verifyCredential(
        agentContext,
        options as W3cV2SdJwtVerifyCredentialOptions
      )
    }

    if (this.getClaimFormat(options.credential) === ClaimFormat.DiVc) {
      this.throwDataIntegrityStubError('verifyCredential', ClaimFormat.DiVc, options as W3cV2DiVerifyCredentialOptions)
    }

    throw new CredoError(
      'Unsupported credential type in options. Credential must be either a W3cV2JwtVerifiablePresentation or a W3cV2SdJwtVerifiablePresentation'
    )
  }

  /**
   * Signs a presentation including the credentials it includes
   *
   * @param presentation the presentation to be signed
   * @returns the signed presentation
   */
  public async signPresentation<Format extends ClaimFormat.JwtW3cVp | ClaimFormat.SdJwtW3cVp | ClaimFormat.DiVp>(
    agentContext: AgentContext,
    options: W3cV2SignPresentationOptions<Format>
  ): Promise<W3cV2VerifiablePresentation<Format>> {
    if (options.format === ClaimFormat.JwtW3cVp) {
      const signed = await this.w3cV2JwtCredentialService.signPresentation(agentContext, options)
      return signed as W3cV2VerifiablePresentation<Format>
    }
    if (options.format === ClaimFormat.SdJwtW3cVp) {
      const signed = await this.w3cV2SdJwtCredentialService.signPresentation(agentContext, options)
      return signed as W3cV2VerifiablePresentation<Format>
    }
    if (options.format === ClaimFormat.DiVp) {
      this.throwDataIntegrityStubError('signPresentation', ClaimFormat.DiVp, options as W3cV2DiSignPresentationOptions)
    }
    throw new CredoError(`Unsupported format in options. Format must be either 'vp+jwt', 'vp+sd-jwt', or 'di_vp'`)
  }

  /**
   * Verifies a presentation including the credentials it includes
   *
   * @param presentation the presentation to be verified
   * @returns the verification result
   */
  public async verifyPresentation(
    agentContext: AgentContext,
    options: W3cV2VerifyPresentationOptions
  ): Promise<W3cV2VerifyPresentationResult> {
    if (options.presentation instanceof W3cV2JwtVerifiablePresentation) {
      this.preparePresentationEntryRoutingStub(options.presentation, ClaimFormat.JwtW3cVp)
      return this.w3cV2JwtCredentialService.verifyPresentation(
        agentContext,
        options as W3cV2JwtVerifyPresentationOptions
      )
    }
    if (options.presentation instanceof W3cV2SdJwtVerifiablePresentation) {
      this.preparePresentationEntryRoutingStub(options.presentation, ClaimFormat.SdJwtW3cVp)
      return this.w3cV2SdJwtCredentialService.verifyPresentation(
        agentContext,
        options as W3cV2SdJwtVerifyPresentationOptions
      )
    }

    if (this.getClaimFormat(options.presentation) === ClaimFormat.DiVp) {
      this.preparePresentationEntryRoutingStub(options.presentation, ClaimFormat.DiVp)
      this.throwDataIntegrityStubError(
        'verifyPresentation',
        ClaimFormat.DiVp,
        options as W3cV2DiVerifyPresentationOptions
      )
    }

    throw new CredoError(
      'Unsupported credential type in options. Presentation must be either a W3cV2JwtVerifiablePresentation or a W3cV2SdJwtVerifiablePresentation'
    )
  }

  // TODO: replace this stub with DI component integration once vc/data-integrity-v1 and w3c-di are ported.
  private throwDataIntegrityStubError(
    operation: 'signCredential' | 'verifyCredential' | 'signPresentation' | 'verifyPresentation',
    claimFormat: ClaimFormat.DiVc | ClaimFormat.DiVp,
    _options:
      | W3cV2DiSignCredentialOptions
      | W3cV2DiVerifyCredentialOptions
      | W3cV2DiSignPresentationOptions
      | W3cV2DiVerifyPresentationOptions,
    issues?: W3cV2DataIntegrityIssue[]
  ): never {
    const cause = mapDataIntegrityIssuesToCredoError({
      operation,
      claimFormat,
      issues,
    })

    throw new CredoError(
      `Data Integrity format '${claimFormat}' is not supported by ${operation} on this branch. ` +
        `Only DI stubs are present in chore/vc2-spec-alignment pending a dedicated DI port.`,
      { cause }
    )
  }

  private getClaimFormat(value: unknown): string | undefined {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined

    const candidate = value as { claimFormat?: unknown }
    return typeof candidate.claimFormat === 'string' ? candidate.claimFormat : undefined
  }

  private preparePresentationEntryRoutingStub(
    presentation: unknown,
    outerClaimFormat: ClaimFormat.JwtW3cVp | ClaimFormat.SdJwtW3cVp | ClaimFormat.DiVp
  ) {
    const resolvedPresentation = this.getResolvedPresentationForRoutingStub(presentation)
    if (!resolvedPresentation) return

    const entries = Array.isArray(resolvedPresentation.verifiableCredential)
      ? resolvedPresentation.verifiableCredential
      : [resolvedPresentation.verifiableCredential]

    entries.forEach((entry, entryIndex) => {
      this.registerVpEntryRoutingHookStub({
        outerClaimFormat,
        entryClaimFormat: this.getClaimFormat(entry),
        entryIndex,
      })
    })
  }

  private getResolvedPresentationForRoutingStub(value: unknown):
    | {
        verifiableCredential: unknown | unknown[]
      }
    | undefined {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined

    const candidate = value as {
      resolvedPresentation?: {
        verifiableCredential?: unknown | unknown[]
      }
    }

    const resolvedPresentation = candidate.resolvedPresentation
    if (!resolvedPresentation?.verifiableCredential) return undefined

    return {
      verifiableCredential: resolvedPresentation.verifiableCredential,
    }
  }

  private registerVpEntryRoutingHookStub(_options: {
    outerClaimFormat: ClaimFormat.JwtW3cVp | ClaimFormat.SdJwtW3cVp | ClaimFormat.DiVp
    entryClaimFormat?: string
    entryIndex: number
  }) {
    // TODO: In the DI port branch, route VP credential entries by entry claim format and shape.
    // TODO: Keep VP-level validations separate from per-entry VC validation aggregation.
  }

  /**
   * Writes a credential to storage
   *
   * @param record the credential to be stored
   * @returns the credential record that was written to storage
   */
  public async storeCredential(
    agentContext: AgentContext,
    options: W3cV2StoreCredentialOptions
  ): Promise<W3cV2CredentialRecord> {
    // Store the w3cV2 credential record
    await this.w3cV2CredentialRepository.save(agentContext, options.record)

    return options.record
  }

  public async removeCredentialRecord(agentContext: AgentContext, id: string) {
    await this.w3cV2CredentialRepository.deleteById(agentContext, id)
  }

  public async getAllCredentialRecords(agentContext: AgentContext): Promise<W3cV2CredentialRecord[]> {
    return await this.w3cV2CredentialRepository.getAll(agentContext)
  }

  public async getCredentialRecordById(agentContext: AgentContext, id: string): Promise<W3cV2CredentialRecord> {
    return await this.w3cV2CredentialRepository.getById(agentContext, id)
  }

  public async findCredentialsByQuery(
    agentContext: AgentContext,
    query: Query<W3cV2CredentialRecord>,
    queryOptions?: QueryOptions
  ): Promise<W3cV2VerifiableCredential[]> {
    const result = await this.w3cV2CredentialRepository.findByQuery(agentContext, query, queryOptions)
    return result.map((record) => record.firstCredential)
  }

  public async findCredentialRecordByQuery(
    agentContext: AgentContext,
    query: Query<W3cV2CredentialRecord>
  ): Promise<W3cV2VerifiableCredential | undefined> {
    const result = await this.w3cV2CredentialRepository.findSingleByQuery(agentContext, query)
    return result?.firstCredential
  }
}
