import type { AgentContext } from '../../../agent/context'
import { CredoError } from '../../../error'
import { injectable } from '../../../plugins'
import { JsonTransformer, MessageValidator } from '../../../utils'
import {
  createW3cDataIntegrityCredoError as createDataIntegrityCredoError,
  type W3cDataIntegrityIssueList as DataIntegrityIssueList,
  W3cDataIntegrityProofService as DataIntegrityProofService,
} from '../../w3c-di/internal'
import { CREDENTIALS_CONTEXT_V2_URL } from '../constants'
import { ClaimFormat } from '../models/ClaimFormat'
import { W3cV2Credential } from '../models/credential/W3cV2Credential'
import type { W3cV2VerifiableCredential } from '../models/credential/W3cV2VerifiableCredential'
import { W3cV2Presentation } from '../models/presentation/W3cV2Presentation'
import type { W3cV2VerifiablePresentation } from '../models/presentation/W3cV2VerifiablePresentation'
import type { W3cV2VerifyCredentialResult, W3cV2VerifyPresentationResult } from '../models/W3cV2VerifyResult'
import { validateVc2ContextBaseline, validateVc2CredentialStatus } from '../validators'
import type {
  W3cV2DiSignCredentialOptions,
  W3cV2DiSignPresentationOptions,
  W3cV2DiVerifyCredentialOptions,
  W3cV2DiVerifyPresentationOptions,
} from '../W3cV2CredentialServiceOptions'
import { W3cV2DataIntegrityContextValidator } from './W3cV2DataIntegrityContextValidator'
import { W3cV2DataIntegrityVerifiableCredential } from './W3cV2DataIntegrityVerifiableCredential'
import { W3cV2DataIntegrityVerifiablePresentation } from './W3cV2DataIntegrityVerifiablePresentation'

@injectable()
export class W3cV2DataIntegrityCredentialService {
  private dataIntegrityProofService: DataIntegrityProofService
  private contextValidator: W3cV2DataIntegrityContextValidator

  public constructor(
    dataIntegrityProofService: DataIntegrityProofService,
    contextValidator: W3cV2DataIntegrityContextValidator
  ) {
    this.dataIntegrityProofService = dataIntegrityProofService
    this.contextValidator = contextValidator
  }

  public async signCredential(
    agentContext: AgentContext,
    options: W3cV2DiSignCredentialOptions
  ): Promise<W3cV2VerifiableCredential<ClaimFormat.DiVc>> {
    const unsecuredCredential = JsonTransformer.toJSON(options.credential)
    if (unsecuredCredential['@context'] === undefined || unsecuredCredential['@context'] === null) {
      unsecuredCredential['@context'] = [CREDENTIALS_CONTEXT_V2_URL]
    }

    MessageValidator.validateSync(JsonTransformer.fromJSON(unsecuredCredential, W3cV2Credential, { validate: false }))

    const contextValidation = validateVc2ContextBaseline(unsecuredCredential['@context'])
    if (!contextValidation.isValid) {
      throw contextValidation.error ?? new CredoError('VC2 credential @context validation failed')
    }

    const proofResult = await this.dataIntegrityProofService.createProof(agentContext, {
      unsecuredDocument: unsecuredCredential,
      verificationMethod: options.verificationMethod,
      proofPurpose: 'assertionMethod',
      cryptosuite: options.cryptosuite,
    })

    if (!proofResult.created) {
      throw createDataIntegrityCredoError(proofResult.errors)
    }

    return new W3cV2DataIntegrityVerifiableCredential({
      securedCredential: {
        ...unsecuredCredential,
        proof: proofResult.proof,
      },
    })
  }

  public async verifyCredential(
    agentContext: AgentContext,
    options: W3cV2DiVerifyCredentialOptions
  ): Promise<W3cV2VerifyCredentialResult> {
    const securedCredential = options.credential.securedCredential
    const verificationResult = Array.isArray(securedCredential.proof)
      ? await this.dataIntegrityProofService.verifyProofSetAndChain(agentContext, securedCredential as never, {
          expectedProofPurpose: 'assertionMethod',
        })
      : await this.dataIntegrityProofService.verifyProof(agentContext, securedCredential as never, {
          expectedProofPurpose: 'assertionMethod',
        })

    if (!verificationResult.verified) {
      return this.invalidResult(verificationResult.errors, 'credential')
    }

    const contextResult = await this.contextValidator.validate(agentContext, securedCredential)
    if (!contextResult.validated) {
      return this.invalidResult(contextResult.errors as DataIntegrityIssueList, 'credential')
    }

    const credentialStatus = validateVc2CredentialStatus({
      credentialStatus: securedCredential.credentialStatus,
      credentialFormat: 'DI',
      verifyCredentialStatus: options.verifyCredentialStatus,
    })

    const isValid = credentialStatus.isValid

    return {
      isValid,
      validations: {
        dataModel: { isValid: true },
        signature: { isValid: true },
        credentialStatus,
        issuerIsSigner: { isValid: true },
      },
    }
  }

  public async signPresentation(
    agentContext: AgentContext,
    options: W3cV2DiSignPresentationOptions
  ): Promise<W3cV2VerifiablePresentation<ClaimFormat.DiVp>> {
    const unsecuredPresentation = JsonTransformer.toJSON(options.presentation)
    if (unsecuredPresentation['@context'] === undefined || unsecuredPresentation['@context'] === null) {
      unsecuredPresentation['@context'] = [CREDENTIALS_CONTEXT_V2_URL]
    }

    MessageValidator.validateSync(
      JsonTransformer.fromJSON(unsecuredPresentation, W3cV2Presentation, { validate: false })
    )

    const contextValidation = validateVc2ContextBaseline(unsecuredPresentation['@context'])
    if (!contextValidation.isValid) {
      throw contextValidation.error ?? new CredoError('VC2 presentation @context validation failed')
    }

    const proofResult = await this.dataIntegrityProofService.createProof(agentContext, {
      unsecuredDocument: unsecuredPresentation,
      verificationMethod: options.verificationMethod,
      proofPurpose: 'authentication',
      cryptosuite: options.cryptosuite,
      challenge: options.challenge,
      domain: options.domain,
    })

    if (!proofResult.created) {
      throw createDataIntegrityCredoError(proofResult.errors)
    }

    const securedPresentation = {
      ...unsecuredPresentation,
      proof: proofResult.proof,
    }

    return new W3cV2DataIntegrityVerifiablePresentation({
      securedPresentation,
      resolvedPresentation: JsonTransformer.fromJSON(securedPresentation, W3cV2Presentation, { validate: false }),
    })
  }

  public async verifyPresentation(
    agentContext: AgentContext,
    options: W3cV2DiVerifyPresentationOptions
  ): Promise<W3cV2VerifyPresentationResult> {
    const securedPresentation = options.presentation.securedPresentation

    const verificationResult = Array.isArray(securedPresentation.proof)
      ? await this.dataIntegrityProofService.verifyProofSetAndChain(agentContext, securedPresentation as never, {
          expectedProofPurpose: 'authentication',
          challenge: options.challenge,
          domain: options.domain,
        })
      : await this.dataIntegrityProofService.verifyProof(agentContext, securedPresentation as never, {
          expectedProofPurpose: 'authentication',
          challenge: options.challenge,
          domain: options.domain,
        })

    if (!verificationResult.verified) {
      return this.invalidResult(verificationResult.errors, 'presentation')
    }

    const presentationContextResult = await this.contextValidator.validate(agentContext, securedPresentation)
    if (!presentationContextResult.validated) {
      return this.invalidResult(presentationContextResult.errors as DataIntegrityIssueList, 'presentation')
    }

    return {
      isValid: true,
      presentation: {
        isValid: true,
        validations: {
          dataModel: { isValid: true },
          holderIsSigner: { isValid: true },
          presentationSignature: { isValid: true },
        },
      },
      credentialEntries: [],
    }
  }

  private invalidResult(errors: DataIntegrityIssueList, target: 'credential'): W3cV2VerifyCredentialResult
  private invalidResult(errors: DataIntegrityIssueList, target: 'presentation'): W3cV2VerifyPresentationResult
  private invalidResult(
    errors: DataIntegrityIssueList,
    target: 'credential' | 'presentation'
  ): W3cV2VerifyCredentialResult | W3cV2VerifyPresentationResult {
    const invalidValidation = this.invalidValidation(errors)

    if (target === 'credential') {
      return {
        isValid: false,
        validations: {
          signature: invalidValidation,
        },
      }
    }

    return this.invalidPresentationResult('presentationSignature', invalidValidation.error)
  }

  private invalidValidation(errors: DataIntegrityIssueList) {
    return {
      isValid: false,
      error: createDataIntegrityCredoError(errors),
    } as const
  }

  private invalidPresentationResult(
    field: 'dataModel' | 'presentationSignature',
    error: Error
  ): W3cV2VerifyPresentationResult {
    return {
      isValid: false,
      presentation: {
        isValid: false,
        validations: {
          [field]: {
            isValid: false,
            error,
          },
        },
      },
      credentialEntries: [],
    }
  }
}
