import type { Checked, PresentationSignCallBackParams, Validated, VerifiablePresentationResult } from '@animo-id/pex'
import { PEX, Status } from '@animo-id/pex'
import { type PartialSdJwtDecodedVerifiableCredential, PEVersion } from '@animo-id/pex/dist/main/lib/index.js'
import type { InputDescriptorV2 } from '@sphereon/pex-models'
import type {
  SdJwtDecodedVerifiableCredential,
  W3CVerifiablePresentation as SphereonW3cVerifiablePresentation,
  W3CVerifiablePresentation,
} from '@sphereon/ssi-types'
import type { AgentContext } from '../../agent'
import { CredoError } from '../../error'
import { injectable } from '../../plugins'
import type { Query } from '../../storage/StorageService'
import { JsonTransformer } from '../../utils'
import { uuid } from '../../utils/uuid'
import type { VerificationMethod } from '../dids'
import { DidsApi, getPublicJwkFromVerificationMethod } from '../dids'
import { getJwkHumanDescription } from '../kms'
import { MdocApi, MdocRecord, type MdocSessionTranscriptOptions } from '../mdoc'
import { MdocDeviceResponse } from '../mdoc/MdocDeviceResponse'
import type { SdJwtVcRecord } from '../sd-jwt-vc'
import { SdJwtVcApi } from '../sd-jwt-vc'
import type { W3cCredentialRecord, W3cJsonPresentation } from '../vc'
import {
  ClaimFormat,
  SignatureSuiteRegistry,
  W3cCredentialRepository,
  W3cCredentialService,
  W3cPresentation,
} from '../vc'
import type { IAnonCredsW3cCredentialService } from '../vc/anoncreds-w3c-credential'
import {
  ANONCREDS_W3C_CREDENTIAL_CRYPTOSUITE,
  AnonCredsW3cCredentialServiceSymbol,
} from '../vc/anoncreds-w3c-credential'
import { purposes } from '../vc/linked-data-proofs/adapters/jsonld-signatures-adapter'
import { DifPresentationExchangeError } from './DifPresentationExchangeError'
import type {
  DifPexCredentialsForRequest,
  DifPexInputDescriptorToCredentials,
  DifPresentationExchangeDefinition,
  DifPresentationExchangeDefinitionV1,
  DifPresentationExchangeDefinitionV2,
  DifPresentationExchangeSubmission,
  VerifiablePresentation,
} from './models'
import { DifPresentationExchangeSubmissionLocation } from './models'
import type { PresentationToCreate } from './utils'
import {
  getCredentialsForRequest,
  getPresentationsToCreate,
  getSphereonOriginalVerifiableCredential,
  getSphereonOriginalVerifiablePresentation,
  getVerifiablePresentationFromEncoded,
} from './utils'

/**
 * @todo create a public api for using dif presentation exchange
 */
@injectable()
export class DifPresentationExchangeService {
  private pex = new PEX()

  public constructor(private w3cCredentialService: W3cCredentialService) {}

  public async getCredentialsForRequest(
    agentContext: AgentContext,
    presentationDefinition: DifPresentationExchangeDefinition
  ): Promise<DifPexCredentialsForRequest> {
    const credentialRecords = await this.queryCredentialForPresentationDefinition(agentContext, presentationDefinition)
    return getCredentialsForRequest(agentContext, this.pex, presentationDefinition, credentialRecords)
  }

  /**
   * Selects the credentials to use based on the output from `getCredentialsForRequest`
   * Use this method if you don't want to manually select the credentials yourself.
   */
  public selectCredentialsForRequest(
    credentialsForRequest: DifPexCredentialsForRequest
  ): DifPexInputDescriptorToCredentials {
    if (!credentialsForRequest.areRequirementsSatisfied) {
      throw new CredoError('Could not find the required credentials for the presentation submission')
    }

    const credentials: DifPexInputDescriptorToCredentials = {}

    for (const requirement of credentialsForRequest.requirements) {
      // Take needsCount entries from the submission entry
      for (const submission of requirement.submissionEntry.slice(0, requirement.needsCount)) {
        if (!credentials[submission.inputDescriptorId]) {
          credentials[submission.inputDescriptorId] = []
        }

        // We pick the first matching VC if we are auto-selecting
        credentials[submission.inputDescriptorId].push(submission.verifiableCredentials[0])
      }
    }

    return credentials
  }

  public validatePresentationDefinition(presentationDefinition: DifPresentationExchangeDefinition) {
    const validation = PEX.validateDefinition(presentationDefinition)
    const errorMessages = this.formatValidated(validation)

    if (errorMessages.length > 0) {
      throw new DifPresentationExchangeError('Invalid presentation definition', { additionalMessages: errorMessages })
    }
  }

  public validatePresentationSubmission(presentationSubmission: DifPresentationExchangeSubmission) {
    const validation = PEX.validateSubmission(presentationSubmission)
    const errorMessages = this.formatValidated(validation)
    if (errorMessages.length > 0) {
      throw new DifPresentationExchangeError('Invalid presentation submission', { additionalMessages: errorMessages })
    }
  }

  public validatePresentation(
    presentationDefinition: DifPresentationExchangeDefinition,
    presentations: VerifiablePresentation | VerifiablePresentation[],
    presentationSubmission?: DifPresentationExchangeSubmission
  ) {
    // FIXME: constraints.statuses (credential status) is schema-validated only;
    // @animo-id/pex has no runtime handler for it — active/revoked/suspended directives are silently ignored.
    const result = this.pex.evaluatePresentation(
      presentationDefinition,
      Array.isArray(presentations)
        ? presentations.map(getSphereonOriginalVerifiablePresentation)
        : getSphereonOriginalVerifiablePresentation(presentations),
      {
        limitDisclosureSignatureSuites: ['DataIntegrityProof.anoncreds-2023'],
        presentationSubmission,
      }
    )

    if (result.areRequiredCredentialsPresent === Status.ERROR) {
      const errorMessages = this.formatValidated(result.errors)
      throw new DifPresentationExchangeError('Invalid presentation', { additionalMessages: errorMessages })
    }
  }

  private formatValidated(v?: Checked[] | Validated) {
    const validated = Array.isArray(v) ? v : v ? [v] : []
    return validated
      .filter((r) => r.status === Status.ERROR)
      .map((r) => r.message)
      .filter((r): r is string => Boolean(r))
  }

  public async createPresentation(
    agentContext: AgentContext,
    options: {
      credentialsForInputDescriptor: DifPexInputDescriptorToCredentials
      presentationDefinition: DifPresentationExchangeDefinition
      /**
       * Defaults to {@link DifPresentationExchangeSubmissionLocation.PRESENTATION}
       */
      presentationSubmissionLocation?: DifPresentationExchangeSubmissionLocation
      /**
       * Also known as `nonce`
       */
      challenge: string

      /**
       * Also known as `audience`
       */
      domain?: string

      /**
       * Mdoc openid4vp specific options
       */
      mdocSessionTranscript?: MdocSessionTranscriptOptions

      /**
       * Optional override for supported formats when verifier constraints are defined outside the presentation definition.
       */
      formatOverride?: DifPresentationExchangeDefinition['format']
    }
  ) {
    const { presentationDefinition, domain, challenge, mdocSessionTranscript } = options
    const presentationSubmissionLocation =
      options.presentationSubmissionLocation ?? DifPresentationExchangeSubmissionLocation.PRESENTATION

    const verifiablePresentationResultsWithFormat: Array<{
      verifiablePresentationResult: VerifiablePresentationResult
      claimFormat: PresentationToCreate['claimFormat']
    }> = []

    const presentationsToCreate = getPresentationsToCreate(options.credentialsForInputDescriptor, {
      presentationDefinition,
      formatOverride: options.formatOverride,
    })

    // Guard against callers bypassing selectCredentialsForRequest: if the PD has submission_requirements,
    // verify the full selection satisfies them now — SR is stripped from per-subject PD slices below.
    if (presentationDefinition.submission_requirements) {
      const allCredentials = Object.values(options.credentialsForInputDescriptor)
        .flat()
        .map((c) => getSphereonOriginalVerifiableCredential(c.credentialRecord))
      const selectResult = this.pex.selectFrom(presentationDefinition, allCredentials)
      if (selectResult.areRequiredCredentialsPresent === Status.ERROR) {
        throw new DifPresentationExchangeError(
          'Selected credentials do not satisfy the submission_requirements of the presentation definition. Use selectCredentialsForRequest to ensure a valid selection.'
        )
      }
    }

    for (const presentationToCreate of presentationsToCreate) {
      let ldpVpSigningOptions: { verificationMethod: VerificationMethod; proofType: string } | undefined
      // We create a presentation for each subject
      // Thus for each subject we need to filter all the related input descriptors and credentials
      const inputDescriptorIds = presentationToCreate.verifiableCredentials.map((c) => c.inputDescriptorId)
      const inputDescriptorsForPresentation = (
        presentationDefinition as DifPresentationExchangeDefinitionV1
      ).input_descriptors.filter((inputDescriptor) => inputDescriptorIds.includes(inputDescriptor.id))

      const presentationDefinitionForSubject: DifPresentationExchangeDefinition = {
        ...presentationDefinition,
        input_descriptors: inputDescriptorsForPresentation,

        // We remove the submission requirements, as it will otherwise fail to create the VP
        submission_requirements: undefined,
      }

      if (presentationToCreate.claimFormat === ClaimFormat.MsoMdoc) {
        if (presentationToCreate.verifiableCredentials.length !== 1) {
          throw new DifPresentationExchangeError(
            'Currently a Mdoc presentation can only be created from a single credential'
          )
        }

        if (!mdocSessionTranscript) {
          throw new DifPresentationExchangeError(
            'Missing mdoc session transcript options for creating MDOC presentation.'
          )
        }

        const { credential, inputDescriptorId } = presentationToCreate.verifiableCredentials[0]

        const deviceResponse = await MdocDeviceResponse.createDeviceResponseWithPresentationDefinition(agentContext, {
          mdocs: [credential.firstCredential],
          presentationDefinition,
          sessionTranscriptOptions: mdocSessionTranscript,
        })

        if (presentationSubmissionLocation !== DifPresentationExchangeSubmissionLocation.EXTERNAL) {
          throw new DifPresentationExchangeError(
            'Only EXTERNAL DifPresentationExchangeSubmissionLocation supported for mdoc presentations'
          )
        }

        verifiablePresentationResultsWithFormat.push({
          verifiablePresentationResult: {
            presentationSubmission: {
              id: `MdocPresentationSubmission ${uuid()}`,
              definition_id: presentationDefinition.id,
              descriptor_map: [
                {
                  id: inputDescriptorId,
                  format: 'mso_mdoc',
                  path: '$',
                },
              ],
            },
            verifiablePresentations: [deviceResponse.encoded],
            presentationSubmissionLocation,
          },
          claimFormat: presentationToCreate.claimFormat,
        })
      } else {
        // Get all the credentials for the presentation
        const credentialsForPresentation = presentationToCreate.verifiableCredentials.map((c) =>
          getSphereonOriginalVerifiableCredential(c.credential)
        )

        if (presentationToCreate.claimFormat === ClaimFormat.LdpVp) {
          const signUsingAnonCredsW3c = this.shouldSignWithAnonCredsW3cService(presentationToCreate)

          if (!signUsingAnonCredsW3c) {
            // AnonCreds DI signing does not use LDP proofType and verificationMethod preselection.
            const verificationMethod = await this.getVerificationMethodForLdpVp(
              agentContext,
              presentationToCreate.subjectIds?.[0],
              presentationDefinitionForSubject
            )

            const proofType = this.getProofTypeForLdpVc(
              agentContext,
              presentationDefinitionForSubject,
              verificationMethod
            )

            ldpVpSigningOptions = {
              verificationMethod,
              proofType,
            }
          }
        }

        const anonCredsW3cProofOptions =
          presentationToCreate.claimFormat === ClaimFormat.LdpVp &&
          this.shouldSignWithAnonCredsW3cService(presentationToCreate)
            ? {
                typeSupportsSelectiveDisclosure: true,
                type: `DataIntegrityProof.${ANONCREDS_W3C_CREDENTIAL_CRYPTOSUITE}`,
              }
            : {}

        const verifiablePresentationResult = await this.pex.verifiablePresentationFrom(
          presentationDefinitionForSubject,
          credentialsForPresentation,
          this.getPresentationSignCallback(agentContext, presentationToCreate, ldpVpSigningOptions),
          {
            proofOptions: {
              challenge,
              domain,

              ...anonCredsW3cProofOptions,
            },
            presentationSubmissionLocation,
          }
        )

        verifiablePresentationResultsWithFormat.push({
          verifiablePresentationResult,
          claimFormat: presentationToCreate.claimFormat,
        })
      }
    }

    if (verifiablePresentationResultsWithFormat.length === 0) {
      throw new DifPresentationExchangeError('No verifiable presentations created')
    }

    if (presentationsToCreate.length !== verifiablePresentationResultsWithFormat.length) {
      throw new DifPresentationExchangeError('Invalid amount of verifiable presentations created')
    }

    const presentationSubmission: DifPresentationExchangeSubmission = {
      id: verifiablePresentationResultsWithFormat[0].verifiablePresentationResult.presentationSubmission.id,
      definition_id:
        verifiablePresentationResultsWithFormat[0].verifiablePresentationResult.presentationSubmission.definition_id,
      descriptor_map: [],
    }

    verifiablePresentationResultsWithFormat.forEach(({ verifiablePresentationResult }, index) => {
      const descriptorMap = verifiablePresentationResult.presentationSubmission.descriptor_map.map((d) => {
        const descriptor = { ...d }

        // when multiple presentations are submitted, path should be $[0], $[1]
        // FIXME: PEX does not set $[n] paths for EXTERNAL multi-VP submissions.
        if (
          presentationSubmissionLocation === DifPresentationExchangeSubmissionLocation.EXTERNAL &&
          verifiablePresentationResultsWithFormat.length > 1
        ) {
          descriptor.path = `$[${index}]`
        }

        return descriptor
      })

      presentationSubmission.descriptor_map.push(...descriptorMap)
    })

    return {
      verifiablePresentations: verifiablePresentationResultsWithFormat.flatMap((resultWithFormat) =>
        resultWithFormat.verifiablePresentationResult.verifiablePresentations.map((vp) =>
          getVerifiablePresentationFromEncoded(agentContext, vp)
        )
      ),
      encodedVerifiablePresentations: verifiablePresentationResultsWithFormat.flatMap(
        (resultWithFormat) =>
          resultWithFormat.verifiablePresentationResult.verifiablePresentations as unknown as (
            | string
            | W3cJsonPresentation
          )[]
      ),
      presentationSubmission,
      presentationSubmissionLocation:
        verifiablePresentationResultsWithFormat[0].verifiablePresentationResult.presentationSubmissionLocation,
    }
  }

  private getSigningAlgorithmFromVerificationMethod(
    verificationMethod: VerificationMethod,
    suitableAlgorithms?: Array<string>
  ) {
    const publicJwk = getPublicJwkFromVerificationMethod(verificationMethod)

    if (suitableAlgorithms) {
      const possibleAlgorithms = publicJwk.supportedSignatureAlgorithms.filter((alg) =>
        suitableAlgorithms?.includes(alg)
      )
      if (!possibleAlgorithms || possibleAlgorithms.length === 0) {
        throw new DifPresentationExchangeError(
          [
            'Found no suitable signing algorithm.',
            `Algorithms supported by Verification method: ${publicJwk.supportedSignatureAlgorithms.join(', ')}`,
            `Suitable algorithms: ${suitableAlgorithms.join(', ')}`,
          ].join('\n')
        )
      }

      return possibleAlgorithms[0]
    }

    return publicJwk.signatureAlgorithm
  }

  private getSigningAlgorithmsForPresentationDefinitionAndInputDescriptors(
    algorithmsSatisfyingDefinition: Array<string>,
    inputDescriptorAlgorithms: Array<Array<string>>
  ) {
    const allDescriptorAlgorithms = inputDescriptorAlgorithms.flat()
    const algorithmsSatisfyingDescriptors = allDescriptorAlgorithms.filter((alg) =>
      inputDescriptorAlgorithms.every((descriptorAlgorithmSet) => descriptorAlgorithmSet.includes(alg))
    )

    const algorithmsSatisfyingPdAndDescriptorRestrictions = algorithmsSatisfyingDefinition.filter((alg) =>
      algorithmsSatisfyingDescriptors.includes(alg)
    )

    if (
      algorithmsSatisfyingDefinition.length > 0 &&
      algorithmsSatisfyingDescriptors.length > 0 &&
      algorithmsSatisfyingPdAndDescriptorRestrictions.length === 0
    ) {
      throw new DifPresentationExchangeError(
        'No signature algorithm found for satisfying restrictions of the presentation definition and input descriptors'
      )
    }

    if (allDescriptorAlgorithms.length > 0 && algorithmsSatisfyingDescriptors.length === 0) {
      throw new DifPresentationExchangeError(
        'No signature algorithm found for satisfying restrictions of the input descriptors'
      )
    }

    let suitableAlgorithms: Array<string> | undefined
    if (algorithmsSatisfyingPdAndDescriptorRestrictions.length > 0) {
      suitableAlgorithms = algorithmsSatisfyingPdAndDescriptorRestrictions
    } else if (algorithmsSatisfyingDescriptors.length > 0) {
      suitableAlgorithms = algorithmsSatisfyingDescriptors
    } else if (algorithmsSatisfyingDefinition.length > 0) {
      suitableAlgorithms = algorithmsSatisfyingDefinition
    }

    return suitableAlgorithms
  }

  private getSigningAlgorithmForJwtVc(
    presentationDefinition: DifPresentationExchangeDefinitionV1 | DifPresentationExchangeDefinitionV2,
    verificationMethod: VerificationMethod
  ) {
    const algorithmsSatisfyingDefinition = presentationDefinition.format?.jwt_vc?.alg ?? []

    const inputDescriptorAlgorithms: Array<Array<string>> = presentationDefinition.input_descriptors
      .map((descriptor) => (descriptor as InputDescriptorV2).format?.jwt_vc?.alg ?? [])
      .filter((alg) => alg.length > 0)

    const suitableAlgorithms = this.getSigningAlgorithmsForPresentationDefinitionAndInputDescriptors(
      algorithmsSatisfyingDefinition,
      inputDescriptorAlgorithms
    )

    return this.getSigningAlgorithmFromVerificationMethod(verificationMethod, suitableAlgorithms)
  }

  private getProofTypeForLdpVc(
    agentContext: AgentContext,
    presentationDefinition: DifPresentationExchangeDefinitionV1 | DifPresentationExchangeDefinitionV2,
    verificationMethod: VerificationMethod
  ) {
    const algorithmsSatisfyingDefinition = presentationDefinition.format?.ldp_vp?.proof_type ?? []

    const inputDescriptorAlgorithms: Array<Array<string>> = presentationDefinition.input_descriptors
      .map((descriptor) => (descriptor as InputDescriptorV2).format?.ldp_vp?.proof_type ?? [])
      .filter((alg) => alg.length > 0)

    const suitableSignatureSuites = this.getSigningAlgorithmsForPresentationDefinitionAndInputDescriptors(
      algorithmsSatisfyingDefinition,
      inputDescriptorAlgorithms
    )

    // For each of the supported algs, find the key types, then find the proof types
    const signatureSuiteRegistry = agentContext.dependencyManager.resolve(SignatureSuiteRegistry)

    const publicJwk = getPublicJwkFromVerificationMethod(verificationMethod)
    const supportedSignatureSuites = signatureSuiteRegistry.getAllByPublicJwkType(publicJwk)
    if (supportedSignatureSuites.length === 0) {
      throw new DifPresentationExchangeError(
        `Couldn't find a supported signature suite for the given jwk ${getJwkHumanDescription(publicJwk.toJson())}`
      )
    }

    if (suitableSignatureSuites) {
      const foundSignatureSuite = supportedSignatureSuites.find((suite) =>
        suitableSignatureSuites.includes(suite.proofType)
      )

      if (!foundSignatureSuite) {
        throw new DifPresentationExchangeError(
          [
            'No possible signature suite found for the given verification method.',
            `Verification method type: ${verificationMethod.type}`,
            `jwk type: ${getJwkHumanDescription(publicJwk.toJson())}`,
            `SupportedSignatureSuites: '${supportedSignatureSuites.map((s) => s.proofType).join(', ')}'`,
            `SuitableSignatureSuites: ${suitableSignatureSuites.join(', ')}`,
          ].join('\n')
        )
      }

      return foundSignatureSuite.proofType
    }

    return supportedSignatureSuites[0].proofType
  }

  /**
   * if all submission descriptors have a format of di | ldp,
   * and all credentials have an anoncreds W3C credential proof we default to
   * signing the presentation using the ANONCREDS_W3C_CREDENTIAL_CRYPTOSUITE
   */
  private shouldSignWithAnonCredsW3cService(
    presentationToCreate: PresentationToCreate,
    presentationSubmission?: DifPresentationExchangeSubmission
  ) {
    if (presentationToCreate.claimFormat !== ClaimFormat.LdpVp) return undefined

    const validDescriptorFormat =
      !presentationSubmission ||
      presentationSubmission.descriptor_map.every((descriptor) =>
        [ClaimFormat.DiVc, ClaimFormat.DiVp, ClaimFormat.LdpVc, ClaimFormat.LdpVp].includes(
          descriptor.format as ClaimFormat
        )
      )

    const credentialsAreSignedWithAnonCredsW3c = presentationToCreate.verifiableCredentials.every(({ credential }) => {
      const firstCredential = credential.firstCredential
      if (firstCredential.claimFormat !== ClaimFormat.LdpVc) return false
      return firstCredential.anonCredsW3cCredentialCryptosuites.includes(ANONCREDS_W3C_CREDENTIAL_CRYPTOSUITE)
    })

    return validDescriptorFormat && credentialsAreSignedWithAnonCredsW3c
  }

  private getPresentationSignCallback(
    agentContext: AgentContext,
    presentationToCreate: PresentationToCreate,
    ldpVpSigningOptions?: { verificationMethod: VerificationMethod; proofType: string }
  ) {
    return async (callBackParams: PresentationSignCallBackParams) => {
      // The created partial proof and presentation, as well as original supplied options
      const {
        presentation: presentationInput,
        options,
        presentationDefinition,
        presentationSubmission,
      } = callBackParams
      const { challenge, domain } = options.proofOptions ?? {}

      if (!challenge) {
        throw new CredoError('challenge MUST be provided when signing a Verifiable Presentation')
      }

      if (presentationToCreate.claimFormat === ClaimFormat.JwtVp) {
        // Determine a suitable verification method for the presentation
        const verificationMethod = await this.getVerificationMethodForSubjectId(
          agentContext,
          presentationToCreate.subjectIds?.[0]
        )

        const w3cPresentation = JsonTransformer.fromJSON(presentationInput, W3cPresentation)
        w3cPresentation.holder = verificationMethod.controller

        const signedPresentation = await this.w3cCredentialService.signPresentation<ClaimFormat.JwtVp>(agentContext, {
          format: ClaimFormat.JwtVp,
          alg: this.getSigningAlgorithmForJwtVc(presentationDefinition, verificationMethod),
          verificationMethod: verificationMethod.id,
          presentation: w3cPresentation,
          challenge,
          domain,
        })

        return signedPresentation.encoded as W3CVerifiablePresentation
      }
      if (presentationToCreate.claimFormat === ClaimFormat.LdpVp) {
        if (this.shouldSignWithAnonCredsW3cService(presentationToCreate, presentationSubmission)) {
          // make sure the descriptors format properties are set correctly
          presentationSubmission.descriptor_map = presentationSubmission.descriptor_map.map((descriptor) => ({
            ...descriptor,
            format: 'di_vp',
          }))
          const anoncredsW3cCredentialService = agentContext.dependencyManager.resolve<IAnonCredsW3cCredentialService>(
            AnonCredsW3cCredentialServiceSymbol
          )
          const presentation = await anoncredsW3cCredentialService.createPresentation(agentContext, {
            presentationDefinition,
            presentationSubmission,
            selectedCredentialRecords: presentationToCreate.verifiableCredentials.map((vc) => vc.credential),
            challenge,
          })
          return {
            ...presentation.toJSON(),
            presentation_submission: presentationSubmission,
          } as unknown as SphereonW3cVerifiablePresentation
        }

        if (!ldpVpSigningOptions) {
          throw new DifPresentationExchangeError('Missing ldp_vp signing options for non-anoncreds LDP presentation')
        }

        const { verificationMethod, proofType } = ldpVpSigningOptions

        const w3cPresentation = JsonTransformer.fromJSON(presentationInput, W3cPresentation)
        w3cPresentation.holder = verificationMethod.controller

        const signedPresentation = await this.w3cCredentialService.signPresentation(agentContext, {
          format: ClaimFormat.LdpVp,
          proofType,
          proofPurpose: new purposes.AuthenticationProofPurpose({ challenge, domain }),
          verificationMethod: verificationMethod.id,
          presentation: w3cPresentation,
          challenge,
          domain,
        })

        return signedPresentation.encoded as W3CVerifiablePresentation
      }
      if (presentationToCreate.claimFormat === ClaimFormat.SdJwtDc) {
        const sdJwtInput = presentationInput as
          | SdJwtDecodedVerifiableCredential
          | PartialSdJwtDecodedVerifiableCredential

        if (!domain) {
          throw new CredoError("Missing 'domain' property, unable to set required 'aud' property in SD-JWT KB-JWT")
        }

        const sdJwtVcApi = this.getSdJwtVcApi(agentContext)

        // NOTE: we use the kmsKeyId from the first credential. We don't support the new useMode (for single-use credentials) for PEX
        const originalSdJwtVc = sdJwtVcApi.fromCompact(sdJwtInput.compactSdJwtVc)
        originalSdJwtVc.kmsKeyId =
          presentationToCreate.verifiableCredentials[0].credential.credentialInstances[0].kmsKeyId

        const sdJwtVc = await sdJwtVcApi.present({
          sdJwtVc: originalSdJwtVc,
          // SD is already handled by PEX, so we presents all keys
          presentationFrame: undefined,
          verifierMetadata: {
            audience: domain,
            nonce: challenge,
            // TODO: we should make this optional
            issuedAt: Math.floor(Date.now() / 1000),
          },
          additionalPayload: presentationToCreate.verifiableCredentials[0].additionalPayload,
        })

        return sdJwtVc
      }
      throw new DifPresentationExchangeError(
        'Only JWT, SD-JWT-VC, JSONLD credentials are supported for a single presentation'
      )
    }
  }

  private async getVerificationMethodForSubjectId(agentContext: AgentContext, subjectId: string | undefined) {
    const verificationMethods = await this.getAuthenticationVerificationMethodsForSubjectId(agentContext, subjectId)

    return verificationMethods[0]
  }

  private async getVerificationMethodForLdpVp(
    agentContext: AgentContext,
    subjectId: string | undefined,
    presentationDefinition: DifPresentationExchangeDefinitionV1 | DifPresentationExchangeDefinitionV2
  ) {
    const verificationMethods = await this.getAuthenticationVerificationMethodsForSubjectId(agentContext, subjectId)

    for (const verificationMethod of verificationMethods) {
      try {
        this.getProofTypeForLdpVc(agentContext, presentationDefinition, verificationMethod)
        return verificationMethod
      } catch (error) {
        if (!(error instanceof DifPresentationExchangeError)) throw error
      }
    }

    const suitableProofTypes = this.getSigningAlgorithmsForPresentationDefinitionAndInputDescriptors(
      presentationDefinition.format?.ldp_vp?.proof_type ?? [],
      presentationDefinition.input_descriptors
        .map((descriptor) => (descriptor as InputDescriptorV2).format?.ldp_vp?.proof_type ?? [])
        .filter((alg) => alg.length > 0)
    )

    throw new DifPresentationExchangeError(
      [
        'No possible verification method and signature suite found for ldp_vp presentation signing.',
        `AllowedProofTypes: ${suitableProofTypes?.join(', ') ?? '[any]'}`,
      ].join('\n')
    )
  }

  private async getAuthenticationVerificationMethodsForSubjectId(
    agentContext: AgentContext,
    subjectId: string | undefined
  ) {
    const didsApi = agentContext.dependencyManager.resolve(DidsApi)

    if (subjectId !== undefined && !subjectId.startsWith('did:')) {
      agentContext.config.logger.warn(
        `Non-DID subject id '${subjectId}' is not supported for signing; falling back to holder-controlled DID`
      )
    }

    const effectiveDid = subjectId?.startsWith('did:') ? subjectId : await this.getHolderDid(agentContext)
    const didDocument = await didsApi.resolveDidDocument(effectiveDid)

    if (!didDocument.authentication || didDocument.authentication.length === 0) {
      throw new DifPresentationExchangeError(
        `No authentication verificationMethods found for did ${effectiveDid} in did document`
      )
    }

    return didDocument.authentication.map((verificationMethod) =>
      typeof verificationMethod === 'string'
        ? didDocument.dereferenceKey(verificationMethod, ['authentication'])
        : verificationMethod
    )
  }

  private async getHolderDid(agentContext: AgentContext): Promise<string> {
    const didsApi = agentContext.dependencyManager.resolve(DidsApi)
    // Best-effort: picks the first created DID regardless of method; may not be resolvable by the verifier.
    const [holderDidRecord] = await didsApi.getCreatedDids()
    if (!holderDidRecord) {
      throw new DifPresentationExchangeError(
        'Cannot determine a signing DID: no created DIDs found in the agent wallet'
      )
    }
    return holderDidRecord.did
  }

  /**
   * Queries the wallet for credentials that match the given presentation definition. This only does an initial query based on the
   * schema of the input descriptors. It does not do any further filtering based on the constraints in the input descriptors.
   */
  private async queryCredentialForPresentationDefinition(
    agentContext: AgentContext,
    presentationDefinition: DifPresentationExchangeDefinition
  ): Promise<Array<SdJwtVcRecord | W3cCredentialRecord | MdocRecord>> {
    const w3cCredentialRepository = agentContext.dependencyManager.resolve(W3cCredentialRepository)
    const w3cQuery: Array<Query<W3cCredentialRecord>> = []
    const sdJwtVcQuery: Array<Query<SdJwtVcRecord>> = []
    const mdocQuery: Array<Query<MdocRecord>> = []

    const presentationDefinitionVersion = PEX.definitionVersionDiscovery(presentationDefinition)

    if (!presentationDefinitionVersion.version) {
      throw new DifPresentationExchangeError(
        'Unable to determine the Presentation Exchange version from the presentation definition',
        presentationDefinitionVersion.error ? { additionalMessages: [presentationDefinitionVersion.error] } : {}
      )
    }

    // FIXME: in the query we should take into account the supported proof types of the verifier
    // this could help enormously in the amount of credentials we have to retrieve from storage.
    if (presentationDefinitionVersion.version === PEVersion.v1) {
      const pd = presentationDefinition as DifPresentationExchangeDefinitionV1

      // The schema.uri can contain either an expanded type, or a context uri
      for (const inputDescriptor of pd.input_descriptors) {
        for (const schema of inputDescriptor.schema) {
          sdJwtVcQuery.push({
            vct: schema.uri,
          })
          w3cQuery.push({
            $or: [{ expandedTypes: [schema.uri] }, { contexts: [schema.uri] }, { types: [schema.uri] }],
          })
          mdocQuery.push({
            docType: inputDescriptor.id,
          })
        }
      }
    } else if (presentationDefinitionVersion.version === PEVersion.v2) {
      // FIXME: As PE version 2 does not have the `schema` anymore, we can't query by schema anymore.
      // We probably need to find some way to do initial filtering,
      // hopefully if there's a filter on the `type` field or something.
    } else {
      throw new DifPresentationExchangeError(
        `Unsupported presentation definition version ${presentationDefinitionVersion.version as unknown as string}`
      )
    }

    const allRecords: Array<SdJwtVcRecord | W3cCredentialRecord | MdocRecord> = []

    // query the wallet ourselves first to avoid the need to query the pex library for all
    // credentials for every proof request
    const w3cCredentialRecords =
      w3cQuery.length > 0
        ? await w3cCredentialRepository.findByQuery(agentContext, { $or: w3cQuery })
        : await w3cCredentialRepository.getAll(agentContext)
    allRecords.push(...w3cCredentialRecords)

    const sdJwtVcApi = this.getSdJwtVcApi(agentContext)
    const sdJwtVcRecords =
      sdJwtVcQuery.length > 0 ? await sdJwtVcApi.findAllByQuery({ $or: sdJwtVcQuery }) : await sdJwtVcApi.getAll()
    allRecords.push(...sdJwtVcRecords)

    const mdocApi = this.getMdocApi(agentContext)
    const mdocRecords = mdocQuery.length > 0 ? await mdocApi.findAllByQuery({ $or: mdocQuery }) : await mdocApi.getAll()
    allRecords.push(...mdocRecords)

    return allRecords
  }

  private getSdJwtVcApi(agentContext: AgentContext) {
    return agentContext.dependencyManager.resolve(SdJwtVcApi)
  }

  private getMdocApi(agentContext: AgentContext) {
    return agentContext.dependencyManager.resolve(MdocApi)
  }
}
