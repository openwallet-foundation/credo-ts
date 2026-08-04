import type { AgentContext } from '../../agent/context'
import { CredoError } from '../../error'
import { injectable } from '../../plugins'
import type { Query, QueryOptions } from '../../storage/StorageService'
import { asArray } from '../../utils/array'
import {
  W3cV2DataIntegrityCredentialService,
  type W3cV2DataIntegrityResolvedPresentation,
  W3cV2DataIntegrityVerifiableCredential,
  W3cV2DataIntegrityVerifiablePresentation,
} from './data-integrity-v1'
import { W3cV2JwtVerifiableCredential, W3cV2JwtVerifiablePresentation } from './jwt-vc'
import { W3cV2JwtCredentialService } from './jwt-vc/W3cV2JwtCredentialService'
import type {
  W3cV2PresentationCredentialEntry,
  W3cV2PresentationCredentialEntryResult,
  W3cV2VerifiableCredential,
  W3cV2VerifiablePresentation,
  W3cV2VerifyCredentialResult,
  W3cV2VerifyPresentationResult,
} from './models'
import {
  ClaimFormat,
  decodeW3cV2VerifiablePresentation,
  W3cV2EnvelopedVerifiableCredential,
  W3cV2EnvelopedVerifiablePresentation,
} from './models'
import { decodeW3cV2VerifiableCredential } from './models/credential/W3cV2VerifiableCredential'
import type { W3cV2Presentation } from './models/presentation/W3cV2Presentation'
import { W3cV2CredentialRecord, W3cV2CredentialRepository } from './repository'
import {
  W3cV2SdJwtCredentialService,
  W3cV2SdJwtVerifiableCredential,
  W3cV2SdJwtVerifiablePresentation,
} from './sd-jwt-vc'
import { getVerificationMethodForJwt } from './v2-jwt-utils'
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
  private w3cV2DataIntegrityCredentialService: W3cV2DataIntegrityCredentialService

  public constructor(
    w3cV2CredentialRepository: W3cV2CredentialRepository,
    w3cV2SdJwtCredentialService: W3cV2SdJwtCredentialService,
    w3cV2JwtCredentialService: W3cV2JwtCredentialService,
    w3cV2DataIntegrityCredentialService: W3cV2DataIntegrityCredentialService
  ) {
    this.w3cV2CredentialRepository = w3cV2CredentialRepository
    this.w3cV2SdJwtCredentialService = w3cV2SdJwtCredentialService
    this.w3cV2JwtCredentialService = w3cV2JwtCredentialService
    this.w3cV2DataIntegrityCredentialService = w3cV2DataIntegrityCredentialService
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
      const signed = await this.w3cV2DataIntegrityCredentialService.signCredential(
        agentContext,
        options as W3cV2DiSignCredentialOptions
      )
      return signed as W3cV2VerifiableCredential<Format>
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
    const credential =
      typeof options.credential === 'string' ? decodeW3cV2VerifiableCredential(options.credential) : options.credential

    if (credential instanceof W3cV2JwtVerifiableCredential) {
      return this.w3cV2JwtCredentialService.verifyCredential(agentContext, {
        ...options,
        credential,
      } as W3cV2JwtVerifyCredentialOptions)
    }

    if (credential instanceof W3cV2SdJwtVerifiableCredential) {
      return this.w3cV2SdJwtCredentialService.verifyCredential(agentContext, {
        ...options,
        credential,
      } as W3cV2SdJwtVerifyCredentialOptions)
    }

    if (credential instanceof W3cV2DataIntegrityVerifiableCredential) {
      return this.w3cV2DataIntegrityCredentialService.verifyCredential(agentContext, {
        ...options,
        credential,
      } as W3cV2DiVerifyCredentialOptions)
    }

    throw new CredoError(
      'Unsupported credential type in options. Credential must be either a W3cV2JwtVerifiableCredential, a W3cV2SdJwtVerifiableCredential, or a W3cV2DataIntegrityVerifiableCredential'
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
      const signed = await this.w3cV2DataIntegrityCredentialService.signPresentation(
        agentContext,
        options as W3cV2DiSignPresentationOptions
      )
      return signed as W3cV2VerifiablePresentation<Format>
    }
    throw new CredoError(`Unsupported format in options. Format must be either 'vp+jwt', 'vp+sd-jwt', or 'di_vp'`)
  }

  /**
   * Verifies a W3C V2 verifiable presentation and each enclosed credential entry.
   *
   * Flow:
   * 1. Verifies the outer VP using the format-specific service (`vp+jwt` or `vp+sd-jwt`).
   * 2. Derives the presenter identifier (holder id, or JWT verification method controller fallback).
   * 3. Recursively walks enclosed entries and verifies each credential entry with the matching
   *    credential verifier (`vc+jwt` or `vc+sd-jwt`) based on the actual enclosed format.
   * 4. Adds `credentialSubjectAuthentication` validation to each credential result by checking
   *    whether the authenticated presenter matches at least one credentialSubject id.
   *
   * Current support and constraints:
   * - Compact string presentations are accepted for `vp+jwt` and `vp+sd-jwt` and normalized
   *   to typed presentation instances before routing.
   * - `di_vp` routes through the DI credential service for outer-VP verification.
   * - `di_vc` entries route through the DI credential service for entry verification.
   * - Nested VP entries are treated as invalid. VC 2.0 verifiable presentations support VC entries,
   *   not VP-within-VP entries.
   *
   * Return semantics:
   * - `presentation` contains the outer VP verification result.
   * - `credentialEntries` contains one result per traversed credential entry, including unsupported
   *   entries as invalid results.
   * - Top-level `isValid` is true only if the outer VP and all credential entry validations are valid.
   *
   * @param agentContext The framework agent context used for resolution and cryptographic checks.
   * @param options Verification input containing the presentation to verify.
   * @returns Aggregated presentation and credential-entry verification result.
   */
  public async verifyPresentation(
    agentContext: AgentContext,
    options: W3cV2VerifyPresentationOptions
  ): Promise<W3cV2VerifyPresentationResult> {
    const presentation =
      typeof options.presentation === 'string'
        ? decodeW3cV2VerifiablePresentation(options.presentation)
        : options.presentation

    const validationResults: W3cV2VerifyPresentationResult = {
      isValid: false,
      presentation: {
        isValid: false,
        validations: {},
      },
      credentialEntries: [],
    }

    let entries: W3cV2PresentationCredentialEntry[] = []
    let signerId: string | undefined

    // Phase 1: verify the outer secured VP envelope and derive the authenticated presenter.
    if (presentation instanceof W3cV2JwtVerifiablePresentation) {
      const presentationResult = await this.w3cV2JwtCredentialService.verifyPresentation(agentContext, {
        ...options,
        presentation,
      } as W3cV2JwtVerifyPresentationOptions)
      validationResults.presentation = presentationResult.presentation

      if (!presentationResult.presentation.isValid) {
        validationResults.isValid = false
        return validationResults
      }

      const holderId = presentation.resolvedPresentation.holderId
      if (holderId) {
        signerId = holderId
      } else {
        try {
          const verificationMethod = await getVerificationMethodForJwt(agentContext, presentation, ['authentication'])
          signerId = verificationMethod.controller
        } catch {
          validationResults.isValid = false
          return validationResults
        }
      }
      entries = this.extractCredentialEntriesFromPresentation(presentation)
    } else if (presentation instanceof W3cV2SdJwtVerifiablePresentation) {
      const presentationResult = await this.w3cV2SdJwtCredentialService.verifyPresentation(agentContext, {
        ...options,
        presentation,
      } as W3cV2SdJwtVerifyPresentationOptions)
      validationResults.presentation = presentationResult.presentation

      if (!presentationResult.presentation.isValid) {
        validationResults.isValid = false
        return validationResults
      }

      const holderId = presentation.resolvedPresentation.holderId
      if (holderId) {
        signerId = holderId
      } else {
        try {
          const verificationMethod = await getVerificationMethodForJwt(agentContext, presentation, ['authentication'])
          signerId = verificationMethod.controller
        } catch {
          validationResults.isValid = false
          return validationResults
        }
      }
      entries = this.extractCredentialEntriesFromPresentation(presentation)
    } else if (presentation instanceof W3cV2DataIntegrityVerifiablePresentation) {
      const presentationResult = await this.w3cV2DataIntegrityCredentialService.verifyPresentation(agentContext, {
        ...options,
        presentation,
      } as W3cV2DiVerifyPresentationOptions)
      validationResults.presentation = presentationResult.presentation

      if (!presentationResult.presentation.isValid) {
        validationResults.isValid = false
        return validationResults
      }

      signerId = presentation.resolvedPresentation.holderId
      if (!signerId) {
        validationResults.isValid = false
        return validationResults
      }

      entries = this.extractCredentialEntriesFromPresentation(presentation)
    } else {
      throw new CredoError(
        'Unsupported credential type in options. Presentation must be either a W3cV2JwtVerifiablePresentation, a W3cV2SdJwtVerifiablePresentation, or a W3cV2DataIntegrityVerifiablePresentation'
      )
    }

    // Phase 2: walk enclosed credential entries and verify recursively by entry format.
    validationResults.credentialEntries = (
      await Promise.all(entries.map((entry) => this.verifyPresentationEntry(agentContext, entry, signerId)))
    ).flat()

    validationResults.isValid =
      validationResults.presentation.isValid && validationResults.credentialEntries.every((entry) => entry.isValid)

    return validationResults
  }

  private async verifyPresentationEntry(
    agentContext: AgentContext,
    entry: W3cV2PresentationCredentialEntry,
    signerId: string
  ): Promise<W3cV2PresentationCredentialEntryResult[]> {
    if (entry instanceof W3cV2DataIntegrityVerifiablePresentation) {
      return [
        this.createInvalidCredentialEntryResult(
          new CredoError('Nested verifiable presentation entries are not supported in VC 2.0 presentations.')
        ),
      ]
    }

    if (entry instanceof W3cV2DataIntegrityVerifiableCredential) {
      const credentialResult = await this.w3cV2DataIntegrityCredentialService.verifyCredential(agentContext, {
        credential: entry,
      } as W3cV2DiVerifyCredentialOptions)

      return [
        this.mergeCredentialSubjectAuthenticationValidation(
          credentialResult,
          signerId,
          entry.resolvedCredential?.credentialSubjectIds ?? []
        ),
      ]
    }

    if (entry instanceof W3cV2EnvelopedVerifiablePresentation) {
      return [
        this.createInvalidCredentialEntryResult(
          new CredoError('Nested verifiable presentation entries are not supported in VC 2.0 presentations.')
        ),
      ]
    }

    if (!(entry instanceof W3cV2EnvelopedVerifiableCredential)) {
      return [
        this.createInvalidCredentialEntryResult(new CredoError('Unsupported credential entry type in presentation.')),
      ]
    }

    const enclosed = entry.envelopedCredential
    let credentialResult: W3cV2VerifyCredentialResult

    if (enclosed instanceof W3cV2JwtVerifiableCredential) {
      credentialResult = await this.w3cV2JwtCredentialService.verifyCredential(agentContext, {
        credential: enclosed,
      } as W3cV2JwtVerifyCredentialOptions)
    } else if (enclosed instanceof W3cV2SdJwtVerifiableCredential) {
      credentialResult = await this.w3cV2SdJwtCredentialService.verifyCredential(agentContext, {
        credential: enclosed,
      } as W3cV2SdJwtVerifyCredentialOptions)
    } else {
      return [
        this.createInvalidCredentialEntryResult(
          new CredoError(
            `Credential entry uses '${this.getClaimFormat(enclosed) ?? 'an unsupported enclosed credential format'}'.`
          )
        ),
      ]
    }

    return [
      this.mergeCredentialSubjectAuthenticationValidation(
        credentialResult,
        signerId,
        entry.resolvedCredential.credentialSubjectIds
      ),
    ]
  }

  private extractCredentialEntriesFromPresentation(
    presentation:
      | W3cV2JwtVerifiablePresentation
      | W3cV2SdJwtVerifiablePresentation
      | W3cV2DataIntegrityVerifiablePresentation
  ): W3cV2PresentationCredentialEntry[] {
    return this.extractCredentialEntriesFromResolvedPresentation(presentation.resolvedPresentation)
  }

  private extractCredentialEntriesFromResolvedPresentation(
    resolvedPresentation: Pick<W3cV2Presentation, 'verifiableCredential'> | W3cV2DataIntegrityResolvedPresentation
  ): W3cV2PresentationCredentialEntry[] {
    return asArray(resolvedPresentation.verifiableCredential) as W3cV2PresentationCredentialEntry[]
  }

  private createInvalidCredentialEntryResult(error: Error): W3cV2PresentationCredentialEntryResult {
    return {
      isValid: false,
      error,
      validations: {},
    }
  }

  private getClaimFormat(value: unknown): string | undefined {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined

    const candidate = value as { claimFormat?: unknown }
    return typeof candidate.claimFormat === 'string' ? candidate.claimFormat : undefined
  }

  private mergeCredentialSubjectAuthenticationValidation(
    credentialResult: W3cV2VerifyCredentialResult,
    signerId: string,
    credentialSubjectIds: string[]
  ) {
    const presentationAuthenticatesCredentialSubject = credentialSubjectIds.some((subjectId) => signerId === subjectId)

    const credentialSubjectAuthentication =
      credentialSubjectIds.length > 0 && !presentationAuthenticatesCredentialSubject
        ? {
            isValid: false,
            error: new CredoError(
              'Credential has one or more credentialSubject ids, but presentation does not authenticate credential subject'
            ),
          }
        : {
            isValid: true,
          }

    return {
      ...credentialResult,
      isValid: credentialResult.isValid && credentialSubjectAuthentication.isValid,
      validations: {
        ...credentialResult.validations,
        credentialSubjectAuthentication,
      },
    }
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
