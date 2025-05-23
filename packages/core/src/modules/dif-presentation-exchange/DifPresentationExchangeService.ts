import type { Checked, PresentationSignCallBackParams, Validated, VerifiablePresentationResult } from '@animo-id/pex'
import { PEX, Status } from '@animo-id/pex'
import type { InputDescriptorV2 } from '@sphereon/pex-models'
import type {
  SdJwtDecodedVerifiableCredential,
  W3CVerifiablePresentation as SphereonW3cVerifiablePresentation,
  W3CVerifiablePresentation,
} from '@sphereon/ssi-types'
import type { AgentContext } from '../../agent'
import type { Query } from '../../storage/StorageService'
import type { VerificationMethod } from '../dids'
import type { SdJwtVcRecord } from '../sd-jwt-vc'
import type { W3cCredentialRecord, W3cJsonPresentation } from '../vc'
import type { IAnonCredsDataIntegrityService } from '../vc/data-integrity/models/IAnonCredsDataIntegrityService'
import type {
  DifPexCredentialsForRequest,
  DifPexInputDescriptorToCredentials,
  DifPresentationExchangeDefinition,
  DifPresentationExchangeDefinitionV1,
  DifPresentationExchangeDefinitionV2,
  DifPresentationExchangeSubmission,
  VerifiablePresentation,
} from './models'
import type { PresentationToCreate } from './utils'

import { injectable } from 'tsyringe'

import { CredoError } from '../../error'
import { JsonTransformer } from '../../utils'
import { DidsApi, getPublicJwkFromVerificationMethod } from '../dids'
import {
  Mdoc,
  MdocApi,
  MdocOpenId4VpDcApiSessionTranscriptOptions,
  MdocOpenId4VpSessionTranscriptOptions,
  MdocRecord,
} from '../mdoc'
import { MdocDeviceResponse } from '../mdoc/MdocDeviceResponse'
import { SdJwtVcApi } from '../sd-jwt-vc'
import {
  ClaimFormat,
  SignatureSuiteRegistry,
  W3cCredentialRepository,
  W3cCredentialService,
  W3cPresentation,
} from '../vc'
import {
  ANONCREDS_DATA_INTEGRITY_CRYPTOSUITE,
  AnonCredsDataIntegrityServiceSymbol,
} from '../vc/data-integrity/models/IAnonCredsDataIntegrityService'

import { PEVersion, PartialSdJwtDecodedVerifiableCredential } from '@animo-id/pex/dist/main/lib'
import { getJwkHumanDescription } from '../kms'
import { DifPresentationExchangeError } from './DifPresentationExchangeError'
import { DifPresentationExchangeSubmissionLocation } from './models'
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
    return getCredentialsForRequest(this.pex, presentationDefinition, credentialRecords)
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
      challenge: string
      domain?: string
      openid4vp?:
        | Omit<MdocOpenId4VpSessionTranscriptOptions, 'verifierGeneratedNonce'>
        | Omit<MdocOpenId4VpDcApiSessionTranscriptOptions, 'verifierGeneratedNonce'>
    }
  ) {
    const { presentationDefinition, domain, challenge, openid4vp } = options
    const presentationSubmissionLocation =
      options.presentationSubmissionLocation ?? DifPresentationExchangeSubmissionLocation.PRESENTATION

    const verifiablePresentationResultsWithFormat: Array<{
      verifiablePresentationResult: VerifiablePresentationResult
      claimFormat: PresentationToCreate['claimFormat']
    }> = []

    const presentationsToCreate = getPresentationsToCreate(options.credentialsForInputDescriptor)
    for (const presentationToCreate of presentationsToCreate) {
      // We create a presentation for each subject
      // Thus for each subject we need to filter all the related input descriptors and credentials
      // FIXME: cast to V1, as tsc errors for strange reasons if not
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
        const mdocRecord = presentationToCreate.verifiableCredentials[0].credential
        if (!openid4vp) {
          throw new DifPresentationExchangeError('Missing openid4vp options for creating MDOC presentation.')
        }

        if (!domain) {
          throw new DifPresentationExchangeError('Missing domain property for creating MDOC presentation.')
        }

        const { deviceResponseBase64Url, presentationSubmission } =
          await MdocDeviceResponse.createPresentationDefinitionDeviceResponse(agentContext, {
            mdocs: [Mdoc.fromBase64Url(mdocRecord.base64Url)],
            presentationDefinition: presentationDefinition,
            sessionTranscriptOptions: {
              ...openid4vp,
              clientId: domain,
              verifierGeneratedNonce: challenge,
            },
          })

        if (presentationSubmissionLocation !== DifPresentationExchangeSubmissionLocation.EXTERNAL) {
          throw new DifPresentationExchangeError(
            'Only EXTERNAL DifPresentationExchangeSubmissionLocation supported for mdoc presentations'
          )
        }

        verifiablePresentationResultsWithFormat.push({
          verifiablePresentationResult: {
            presentationSubmission: presentationSubmission,
            verifiablePresentations: [deviceResponseBase64Url],
            presentationSubmissionLocation,
          },
          claimFormat: presentationToCreate.claimFormat,
        })
      } else {
        // Get all the credentials for the presentation
        const credentialsForPresentation = presentationToCreate.verifiableCredentials.map((c) =>
          getSphereonOriginalVerifiableCredential(c.credential)
        )

        const verifiablePresentationResult = await this.pex.verifiablePresentationFrom(
          presentationDefinitionForSubject,
          credentialsForPresentation,
          this.getPresentationSignCallback(agentContext, presentationToCreate),
          {
            proofOptions: {
              challenge,
              domain,
            },
            signatureOptions: {},
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
        // FIXME: this should be addressed in the PEX/OID4VP lib.
        // See https://github.com/Sphereon-Opensource/SIOP-OID4VP/issues/62
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
    const algorithmsSatisfyingDefinition = presentationDefinition.format?.ldp_vc?.proof_type ?? []

    const inputDescriptorAlgorithms: Array<Array<string>> = presentationDefinition.input_descriptors
      .map((descriptor) => (descriptor as InputDescriptorV2).format?.ldp_vc?.proof_type ?? [])
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

      return supportedSignatureSuites[0].proofType
    }

    return supportedSignatureSuites[0].proofType
  }

  /**
   * if all submission descriptors have a format of di | ldp,
   * and all credentials have an ANONCREDS_DATA_INTEGRITY proof we default to
   * signing the presentation using the ANONCREDS_DATA_INTEGRITY_CRYPTOSUITE
   */
  private shouldSignUsingAnonCredsDataIntegrity(
    presentationToCreate: PresentationToCreate,
    presentationSubmission: DifPresentationExchangeSubmission
  ) {
    if (presentationToCreate.claimFormat !== ClaimFormat.LdpVp) return undefined

    const validDescriptorFormat = presentationSubmission.descriptor_map.every((descriptor) =>
      [ClaimFormat.DiVc, ClaimFormat.DiVp, ClaimFormat.LdpVc, ClaimFormat.LdpVp].includes(
        descriptor.format as ClaimFormat
      )
    )

    const credentialAreSignedUsingAnonCredsDataIntegrity = presentationToCreate.verifiableCredentials.every(
      ({ credential }) => {
        if (credential.credential.claimFormat !== ClaimFormat.LdpVc) return false
        return credential.credential.dataIntegrityCryptosuites.includes(ANONCREDS_DATA_INTEGRITY_CRYPTOSUITE)
      }
    )

    return validDescriptorFormat && credentialAreSignedUsingAnonCredsDataIntegrity
  }

  private getPresentationSignCallback(agentContext: AgentContext, presentationToCreate: PresentationToCreate) {
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
        if (!presentationToCreate.subjectIds) {
          throw new DifPresentationExchangeError('Cannot create presentation for credentials without subject id')
        }

        // Determine a suitable verification method for the presentation
        const verificationMethod = await this.getVerificationMethodForSubjectId(
          agentContext,
          presentationToCreate.subjectIds[0]
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
        if (this.shouldSignUsingAnonCredsDataIntegrity(presentationToCreate, presentationSubmission)) {
          // make sure the descriptors format properties are set correctly
          presentationSubmission.descriptor_map = presentationSubmission.descriptor_map.map((descriptor) => ({
            ...descriptor,
            format: 'di_vp',
          }))
          const anoncredsDataIntegrityService = agentContext.dependencyManager.resolve<IAnonCredsDataIntegrityService>(
            AnonCredsDataIntegrityServiceSymbol
          )
          const presentation = await anoncredsDataIntegrityService.createPresentation(agentContext, {
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

        if (!presentationToCreate.subjectIds) {
          throw new DifPresentationExchangeError('Cannot create presentation for credentials without subject id')
        }
        // Determine a suitable verification method for the presentation
        const verificationMethod = await this.getVerificationMethodForSubjectId(
          agentContext,
          presentationToCreate.subjectIds[0]
        )

        const w3cPresentation = JsonTransformer.fromJSON(presentationInput, W3cPresentation)
        w3cPresentation.holder = verificationMethod.controller

        const signedPresentation = await this.w3cCredentialService.signPresentation(agentContext, {
          format: ClaimFormat.LdpVp,
          // TODO: we should move the check for which proof to use for a presentation to earlier
          // as then we know when determining which VPs to submit already if the proof types are supported
          // by the verifier, and we can then just add this to the vpToCreate interface
          proofType: this.getProofTypeForLdpVc(agentContext, presentationDefinition, verificationMethod),
          proofPurpose: 'authentication',
          verificationMethod: verificationMethod.id,
          presentation: w3cPresentation,
          challenge,
          domain,
        })

        return signedPresentation.encoded as W3CVerifiablePresentation
      }
      if (presentationToCreate.claimFormat === ClaimFormat.SdJwtVc) {
        const sdJwtInput = presentationInput as
          | SdJwtDecodedVerifiableCredential
          | PartialSdJwtDecodedVerifiableCredential

        if (!domain) {
          throw new CredoError("Missing 'domain' property, unable to set required 'aud' property in SD-JWT KB-JWT")
        }

        const sdJwtVcApi = this.getSdJwtVcApi(agentContext)
        const sdJwtVc = await sdJwtVcApi.present({
          compactSdJwtVc: sdJwtInput.compactSdJwtVc,
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

  private async getVerificationMethodForSubjectId(agentContext: AgentContext, subjectId: string) {
    const didsApi = agentContext.dependencyManager.resolve(DidsApi)

    if (!subjectId.startsWith('did:')) {
      throw new DifPresentationExchangeError(
        `Only dids are supported as credentialSubject id. ${subjectId} is not a valid did`
      )
    }

    const didDocument = await didsApi.resolveDidDocument(subjectId)

    if (!didDocument.authentication || didDocument.authentication.length === 0) {
      throw new DifPresentationExchangeError(
        `No authentication verificationMethods found for did ${subjectId} in did document`
      )
    }

    // the signature suite to use for the presentation is dependant on the credentials we share.
    // 1. Get the verification method for this given proof purpose in this DID document
    let [verificationMethod] = didDocument.authentication
    if (typeof verificationMethod === 'string') {
      verificationMethod = didDocument.dereferenceKey(verificationMethod, ['authentication'])
    }

    return verificationMethod
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
      // We probably need
      // to find some way to do initial filtering, hopefully if there's a filter on the `type` field or something.
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
