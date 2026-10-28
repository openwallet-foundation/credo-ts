import {
  createPresentationSubmission,
  type FieldMatch,
  getEffectiveFormat,
  getPresentationDefinitionIssues,
  getPresentationFormat,
  type InputDescriptorV2,
  type ParsedPresentationDefinition,
  type PresentationSubmissionEntry,
  presentationSubmissionModel,
  runPexQuery,
  safeParsePresentationDefinition,
} from 'presentation-exchange'
import type { AgentContext } from '../../agent'
import { CredoError } from '../../error'
import { injectable } from '../../plugins'
import type { Query } from '../../storage/StorageService'
import { asArray, dateToSeconds, JsonTransformer } from '../../utils'
import { uuid } from '../../utils/uuid'
import type { VerificationMethod } from '../dids'
import { DidsApi, getPublicJwkFromVerificationMethod } from '../dids'
import { getJwkHumanDescription } from '../kms'
import { MdocApi, MdocRecord, type MdocSessionTranscriptOptions } from '../mdoc'
import { MdocDeviceResponse } from '../mdoc/MdocDeviceResponse'
import { fieldMatchesToDocumentRequest } from '../mdoc/utils/inputDescriptorToDocumentRequest'
import type { SdJwtVcRecord } from '../sd-jwt-vc'
import { SdJwtVcApi } from '../sd-jwt-vc'
import { buildDisclosureFrameForPayload, buildPresentationFrameForPaths } from '../sd-jwt-vc/disclosureFrame'
import type { W3cCredentialRecord, W3cJsonPresentation } from '../vc'
import {
  ClaimFormat,
  SignatureSuiteRegistry,
  W3cCredentialRepository,
  W3cCredentialService,
  W3cJsonLdVerifiablePresentation,
  W3cJwtVerifiablePresentation,
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
  DifPexInputDescriptorToCredentials,
  DifPexQueryResult,
  DifPresentationExchangeDefinition,
  DifPresentationExchangeDefinitionV1,
  DifPresentationExchangeDefinitionV2,
  DifPresentationExchangeSubmission,
  SubmissionEntryCredential,
  VerifiablePresentation,
} from './models'
import { DifPresentationExchangeSubmissionLocation } from './models'
import type { PresentationToCreate } from './utils'
import {
  getCredentialsForRequest,
  getPresentationsToCreate,
  getVerifiablePresentationFromEncoded,
  selectCredentialsForRequest,
} from './utils'
import {
  formatMismatchReasons,
  getPexCredentialsForRecords,
  runPexPresentationSubmission,
} from './utils/pexCredentials'

const PRESENTATION_SUBMISSION_CONTEXT_URL = 'https://identity.foundation/presentation-exchange/submission/v1'

/**
 * @todo create a public api for using dif presentation exchange
 */
@injectable()
export class DifPresentationExchangeService {
  public constructor(private w3cCredentialService: W3cCredentialService) {}

  /**
   * Queries the credentials in the wallet with the presentation definition. For each input descriptor this
   * returns the credentials that satisfy it, and the ones that don't with the reasons why, so a wallet can
   * show what is missing. Also when the presentation definition can't be satisfied.
   */
  public async getCredentialsForRequest(
    agentContext: AgentContext,
    presentationDefinition: DifPresentationExchangeDefinition
  ): Promise<DifPexQueryResult> {
    const parsedDefinition = this.parsePresentationDefinition(presentationDefinition)
    const credentialRecords = await this.queryCredentialForPresentationDefinition(agentContext, parsedDefinition)
    return getCredentialsForRequest(parsedDefinition, credentialRecords)
  }

  /**
   * Selects the credentials to use based on the output from `getCredentialsForRequest`
   * Use this method if you don't want to manually select the credentials yourself.
   */
  public selectCredentialsForRequest(queryResult: DifPexQueryResult): DifPexInputDescriptorToCredentials {
    return selectCredentialsForRequest(queryResult)
  }

  public validatePresentationDefinition(presentationDefinition: DifPresentationExchangeDefinition) {
    this.parsePresentationDefinition(presentationDefinition)
  }

  public validatePresentationSubmission(presentationSubmission: DifPresentationExchangeSubmission) {
    const result = presentationSubmissionModel.safeParse(presentationSubmission)
    if (!result.success) {
      throw new DifPresentationExchangeError('Invalid presentation submission', {
        additionalMessages: [result.message],
      })
    }
  }

  /**
   * Checks that the presentations satisfy the presentation definition. Every credential is checked against
   * the input descriptor its `descriptor_map` entry claims it satisfies, and the satisfied input descriptors
   * against the submission requirements.
   *
   * Without `presentationSubmission`, the presentation must be a single W3C presentation that embeds it.
   *
   * This does not verify the presentations themselves (signatures, holder binding).
   */
  public validatePresentation(
    presentationDefinition: DifPresentationExchangeDefinition,
    presentations: VerifiablePresentation | VerifiablePresentation[],
    presentationSubmission?: DifPresentationExchangeSubmission
  ) {
    const parsedDefinition = this.parsePresentationDefinition(presentationDefinition)
    const presentationsArray = asArray(presentations)
    const submission = presentationSubmission ?? this.getEmbeddedPresentationSubmission(presentationsArray)

    const result = runPexPresentationSubmission(parsedDefinition, submission, presentationsArray)

    if (!result.valid) {
      const errorMessages = [
        ...result.issues,
        ...result.descriptors
          .filter((descriptor) => !descriptor.satisfied)
          .flatMap((descriptor) =>
            formatMismatchReasons(descriptor).map(
              (reason) => `Descriptor ${descriptor.descriptor_index} ('${descriptor.input_descriptor_id}'): ${reason}`
            )
          ),
      ]

      throw new DifPresentationExchangeError('Invalid presentation', {
        additionalMessages:
          errorMessages.length > 0 ? errorMessages : ['Presentations do not satisfy the submission requirements'],
      })
    }
  }

  public async createPresentation(
    agentContext: AgentContext,
    options: {
      credentialsForInputDescriptor: DifPexInputDescriptorToCredentials
      presentationDefinition: DifPresentationExchangeDefinition
      /**
       * Defaults to {@link DifPresentationExchangeSubmissionLocation.Presentation}
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
    }
  ) {
    const { presentationDefinition, domain, challenge, mdocSessionTranscript } = options
    const presentationSubmissionLocation =
      options.presentationSubmissionLocation ?? DifPresentationExchangeSubmissionLocation.Presentation
    const isExternal = presentationSubmissionLocation === DifPresentationExchangeSubmissionLocation.External
    const parsedDefinition = this.parsePresentationDefinition(presentationDefinition)

    const getMatch = this.assertCredentialsSatisfyInputDescriptors(
      parsedDefinition,
      options.credentialsForInputDescriptor
    )

    const presentationsToCreate = getPresentationsToCreate(options.credentialsForInputDescriptor)
    if (presentationsToCreate.length === 0) {
      throw new DifPresentationExchangeError('No verifiable presentations created')
    }

    const presentationSubmission: DifPresentationExchangeSubmission = {
      id: uuid(),
      definition_id: presentationDefinition.id,
      descriptor_map: [],
    }
    const encodedVerifiablePresentations: Array<string | W3cJsonPresentation> = []

    for (const [presentationIndex, presentationToCreate] of presentationsToCreate.entries()) {
      // when multiple presentations are submitted externally, paths are $[0], $[1]
      const entries = presentationToCreate.verifiableCredentials.map(
        ({ credential, inputDescriptorId }, credentialIndex): PresentationSubmissionEntry => ({
          input_descriptor_id: inputDescriptorId,
          format: getMatch(inputDescriptorId, credential).format,
          presentation_index: isExternal && presentationsToCreate.length > 1 ? presentationIndex : undefined,
          credential_index: credentialIndex,
        })
      )
      const submissionForPresentation = createPresentationSubmission(parsedDefinition.definition, {
        id: presentationSubmission.id,
        location: presentationSubmissionLocation,
        entries,
      })

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

        if (!isExternal) {
          throw new DifPresentationExchangeError(
            'Only the External DifPresentationExchangeSubmissionLocation is supported for mdoc presentations'
          )
        }

        // Requests the data elements the fields matched, which is also what querying showed. The input descriptor id
        // is the doctype (ISO 18013-7).
        const { credential, inputDescriptorId } = presentationToCreate.verifiableCredentials[0]
        const mdoc = credential.firstCredential
        const documentRequest = fieldMatchesToDocumentRequest(
          inputDescriptorId,
          getMatch(inputDescriptorId, credential).fields
        )
        if (!documentRequest) {
          throw new DifPresentationExchangeError(
            `Input descriptor '${inputDescriptorId}' requests no data element of the mdoc. A field path must address one, such as $['org.iso.18013.5.1']['family_name']`
          )
        }

        const deviceResponse = await MdocDeviceResponse.createDeviceResponse(agentContext, {
          mdocs: [mdoc],
          documentRequests: [documentRequest],
          sessionTranscriptOptions: mdocSessionTranscript,
        })

        encodedVerifiablePresentations.push(deviceResponse.encoded)
      } else if (presentationToCreate.claimFormat === ClaimFormat.SdJwtDc) {
        if (!isExternal) {
          throw new DifPresentationExchangeError(
            'Only the External DifPresentationExchangeSubmissionLocation is supported for SD-JWT VC presentations'
          )
        }

        encodedVerifiablePresentations.push(
          await this.createSdJwtVcPresentation(agentContext, presentationToCreate, { challenge, domain })
        )
      } else {
        // We create a presentation for each subject, with only the input descriptors of its credentials
        const inputDescriptorIds = presentationToCreate.verifiableCredentials.map((c) => c.inputDescriptorId)
        const presentationDefinitionForSubject = {
          ...presentationDefinition,
          input_descriptors: presentationDefinition.input_descriptors.filter((inputDescriptor) =>
            inputDescriptorIds.includes(inputDescriptor.id)
          ),
          submission_requirements: undefined,
        } as DifPresentationExchangeDefinition

        if (this.shouldSignWithAnonCredsW3cService(presentationToCreate, submissionForPresentation)) {
          // make sure the descriptors format properties are set correctly
          submissionForPresentation.descriptor_map = submissionForPresentation.descriptor_map.map((descriptor) => ({
            ...descriptor,
            format: 'di_vp',
          }))
        }

        encodedVerifiablePresentations.push(
          await this.createW3cPresentation(agentContext, presentationToCreate, {
            presentationDefinition: presentationDefinitionForSubject,
            credentialFormats: entries.map(({ format }) => format),
            presentationSubmission: submissionForPresentation,
            presentationSubmissionLocation,
            challenge,
            domain,
          })
        )
      }

      presentationSubmission.descriptor_map.push(...submissionForPresentation.descriptor_map)
    }

    return {
      verifiablePresentations: encodedVerifiablePresentations.map((encoded) =>
        getVerifiablePresentationFromEncoded(agentContext, encoded)
      ),
      encodedVerifiablePresentations,
      presentationSubmission,
      presentationSubmissionLocation,
    }
  }

  /**
   * Checks the selected credentials against the input descriptors they are selected for, as these can be
   * selected by hand. Whether they satisfy the submission requirements is left to the verifier.
   *
   * Returns a function giving how a credential satisfies an input descriptor: the format designation to present it
   * under, the most preferred one it satisfies, and the fields it matched. The input descriptor can restrict designations differently, such as
   * `vc+sd-jwt` and `dc+sd-jwt`, so this is not always the first one it allows.
   */
  private assertCredentialsSatisfyInputDescriptors(
    parsedDefinition: ParsedPresentationDefinition,
    credentialsForInputDescriptor: DifPexInputDescriptorToCredentials
  ) {
    const parsed = parsedDefinition
    const errorMessages: string[] = []
    type Match = { format: PresentationSubmissionEntry['format']; fields: FieldMatch[] }
    const matches = new Map<string, Map<SubmissionEntryCredential['credentialRecord'], Match>>()

    for (const [inputDescriptorId, credentials] of Object.entries(credentialsForInputDescriptor)) {
      const inputDescriptor = parsed.definition.input_descriptors.find(({ id }) => id === inputDescriptorId)
      if (!inputDescriptor) {
        errorMessages.push(`Input descriptor '${inputDescriptorId}' is not in the presentation definition`)
        continue
      }

      const records = credentials.map(({ credentialRecord }) => credentialRecord)
      const { credentials: pexCredentials, recordIndexes } = getPexCredentialsForRecords(records)
      const [result] = runPexQuery(
        {
          ...parsed,
          definition: {
            ...parsed.definition,
            input_descriptors: [inputDescriptor],
            submission_requirements: undefined,
          },
        } as ParsedPresentationDefinition,
        { credentials: pexCredentials }
      ).input_descriptors

      const matchForRecord = new Map<SubmissionEntryCredential['credentialRecord'], Match>()
      matches.set(inputDescriptorId, matchForRecord)

      for (const [recordIndex, record] of records.entries()) {
        const recordMatches = result.matching_credentials
          .filter(({ credential_index }) => recordIndexes[credential_index] === recordIndex)
          .sort((a, b) => a.credential_index - b.credential_index)
        // A credential is only offered under credential designations, see `getPexCredentialsForRecords`
        const designations = recordMatches.map(
          ({ credential_index }) =>
            pexCredentials[credential_index].credential_format as PresentationSubmissionEntry['format']
        )
        if (recordMatches.length > 0) {
          const format = this.getPreferredFormatDesignation(parsed.definition, inputDescriptor, designations)
          matchForRecord.set(record, { format, fields: recordMatches[designations.indexOf(format)].fields })
          continue
        }

        errorMessages.push(
          ...result.non_matching_credentials
            .filter(({ credential_index }) => recordIndexes[credential_index] === recordIndex)
            .flatMap(formatMismatchReasons)
            .map((issue) => `Credential ${record.id} for input descriptor '${inputDescriptorId}': ${issue}`)
        )
      }
    }

    if (errorMessages.length > 0) {
      throw new DifPresentationExchangeError(
        'Could not create presentation, selected credentials do not satisfy the presentation definition',
        { additionalMessages: errorMessages }
      )
    }

    return (inputDescriptorId: string, record: SubmissionEntryCredential['credentialRecord']) => {
      const match = matches.get(inputDescriptorId)?.get(record)
      if (!match) {
        throw new DifPresentationExchangeError(
          `Credential ${record.id} was not checked against input descriptor '${inputDescriptorId}'`
        )
      }
      return match
    }
  }

  /**
   * The designation to present a credential under, of the `designations` it satisfies an input descriptor under.
   *
   * A presentation format such as `jwt_vp_json` also admits the credential formats it carries, so a credential can
   * satisfy a format that doesn't name its designation. The designation the format names, either itself or through
   * its presentation format, is used. Otherwise, or when it names several, the most preferred one is used, as the
   * credentials of a record are ordered by preference.
   */
  private getPreferredFormatDesignation(
    definition: ParsedPresentationDefinition['definition'],
    inputDescriptor: ParsedPresentationDefinition['definition']['input_descriptors'][number],
    designations: PresentationSubmissionEntry['format'][]
  ) {
    const format = getEffectiveFormat(definition, inputDescriptor) ?? {}
    const isNamed = (designation: PresentationSubmissionEntry['format']) =>
      designation in format || getPresentationFormat(designation).presentationFormat in format

    return designations.find(isNamed) ?? designations[0]
  }

  private parsePresentationDefinition(
    presentationDefinition: DifPresentationExchangeDefinition
  ): ParsedPresentationDefinition {
    const result = safeParsePresentationDefinition(presentationDefinition)
    if (!result.success) {
      throw new DifPresentationExchangeError('Invalid presentation definition', {
        additionalMessages: [result.message],
      })
    }

    // Parsing only checks the structure. These are the checks that need the whole definition, such as duplicate
    // input descriptor ids, or submission requirements that reference an undeclared group or have min > max.
    const issues = getPresentationDefinitionIssues(result.definition)
    if (issues.length > 0) {
      throw new DifPresentationExchangeError('Invalid presentation definition', {
        additionalMessages: issues.map((issue) => `${issue.path}: ${issue.message}`),
      })
    }

    return { version: result.version, definition: result.definition } as ParsedPresentationDefinition
  }

  /**
   * The presentation submission embedded in a single W3C presentation, as in the DIDComm attachment.
   */
  private getEmbeddedPresentationSubmission(presentations: VerifiablePresentation[]) {
    const [presentation, ...otherPresentations] = presentations
    if (
      otherPresentations.length > 0 ||
      !(presentation instanceof W3cJwtVerifiablePresentation || presentation instanceof W3cJsonLdVerifiablePresentation)
    ) {
      throw new DifPresentationExchangeError(
        'A presentation submission is required, unless it is embedded in a single W3C presentation'
      )
    }

    const json =
      presentation instanceof W3cJwtVerifiablePresentation ? presentation.presentation.toJSON() : presentation.toJSON()
    const submission = json.presentation_submission
    if (!submission) {
      throw new DifPresentationExchangeError('Presentation does not contain a presentation submission')
    }

    this.validatePresentationSubmission(submission)
    return submission
  }

  private async createSdJwtVcPresentation(
    agentContext: AgentContext,
    presentationToCreate: Extract<PresentationToCreate, { claimFormat: ClaimFormat.SdJwtDc }>,
    { challenge, domain }: { challenge: string; domain?: string }
  ) {
    if (!domain) {
      throw new CredoError("Missing 'domain' property, unable to set required 'aud' property in SD-JWT KB-JWT")
    }

    const { credential, disclosedPaths, disclosedPayload, additionalPayload } =
      presentationToCreate.verifiableCredentials[0]

    // NOTE: we use the first credential instance. We don't support the new useMode (for single-use credentials) for PEX
    const sdJwtVc = credential.firstCredential
    const presentationFrame = disclosedPaths
      ? buildPresentationFrameForPaths(sdJwtVc.compact, disclosedPaths)
      : buildDisclosureFrameForPayload(disclosedPayload)

    return this.getSdJwtVcApi(agentContext).present({
      sdJwtVc,
      presentationFrame,
      verifierMetadata: {
        audience: domain,
        nonce: challenge,
        // TODO: we should make this optional
        issuedAt: dateToSeconds(new Date()),
      },
      additionalPayload,
    })
  }

  private async createW3cPresentation(
    agentContext: AgentContext,
    presentationToCreate: Extract<PresentationToCreate, { claimFormat: ClaimFormat.JwtVp | ClaimFormat.LdpVp }>,
    options: {
      presentationDefinition: DifPresentationExchangeDefinition
      // The format designations the credentials are presented under
      credentialFormats: string[]
      presentationSubmission: DifPresentationExchangeSubmission
      presentationSubmissionLocation: DifPresentationExchangeSubmissionLocation
      challenge: string
      domain?: string
    }
  ): Promise<string | W3cJsonPresentation> {
    const { presentationDefinition, credentialFormats, presentationSubmission, challenge, domain } = options

    if (!challenge) {
      throw new CredoError('challenge MUST be provided when signing a Verifiable Presentation')
    }

    if (
      presentationToCreate.claimFormat === ClaimFormat.LdpVp &&
      this.shouldSignWithAnonCredsW3cService(presentationToCreate, presentationSubmission)
    ) {
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
      } as W3cJsonPresentation
    }

    if (!presentationToCreate.subjectIds) {
      throw new DifPresentationExchangeError('Cannot create presentation for credentials without subject id')
    }

    // Determine a suitable verification method for the presentation
    const verificationMethod = await this.getVerificationMethodForSubjectId(
      agentContext,
      presentationToCreate.subjectIds[0]
    )

    const isEmbedded = options.presentationSubmissionLocation === DifPresentationExchangeSubmissionLocation.Presentation
    const w3cPresentation = JsonTransformer.fromJSON(
      {
        '@context': [
          'https://www.w3.org/2018/credentials/v1',
          ...(isEmbedded ? [PRESENTATION_SUBMISSION_CONTEXT_URL] : []),
        ],
        type: ['VerifiablePresentation', ...(isEmbedded ? ['PresentationSubmission'] : [])],
        ...(isEmbedded && { presentation_submission: presentationSubmission }),
        verifiableCredential: presentationToCreate.verifiableCredentials.map(
          ({ credential }) => credential.firstCredential.encoded
        ),
      },
      W3cPresentation
    )
    w3cPresentation.holder = verificationMethod.controller

    if (presentationToCreate.claimFormat === ClaimFormat.JwtVp) {
      const signedPresentation = await this.w3cCredentialService.signPresentation<ClaimFormat.JwtVp>(agentContext, {
        format: ClaimFormat.JwtVp,
        alg: this.getSigningAlgorithmForJwtVp(presentationDefinition, credentialFormats, verificationMethod),
        verificationMethod: verificationMethod.id,
        presentation: w3cPresentation,
        challenge,
        domain,
      })

      return signedPresentation.encoded
    }

    const signedPresentation = await this.w3cCredentialService.signPresentation(agentContext, {
      format: ClaimFormat.LdpVp,
      // TODO: we should move the check for which proof to use for a presentation to earlier
      // as then we know when determining which VPs to submit already if the proof types are supported
      // by the verifier, and we can then just add this to the vpToCreate interface
      proofType: this.getProofTypeForLdpVp(agentContext, presentationDefinition, verificationMethod),
      proofPurpose: new purposes.AuthenticationProofPurpose({ challenge, domain }),
      verificationMethod: verificationMethod.id,
      presentation: w3cPresentation,
      challenge,
      domain,
    })

    return signedPresentation.encoded as W3cJsonPresentation
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

  /**
   * What the formats of the presentation definition and its input descriptors restrict for a presentation, for the
   * `property` of a format designation (such as `alg`).
   *
   * The presentation must use one of the `required` values: those of the presentation formats (such as `jwt_vp`),
   * which restrict the presentation itself. The `preferred` values are those of the credential formats (such as
   * `jwt_vc`), which restrict the credentials. Verifiers often only restrict those, and then likely accept them for
   * the presentation as well.
   */
  private getPresentationFormatRestrictions(
    presentationDefinition: DifPresentationExchangeDefinitionV1 | DifPresentationExchangeDefinitionV2,
    {
      presentationFormats,
      credentialFormats,
      property,
    }: { presentationFormats: string[]; credentialFormats: string[]; property: 'alg' | 'proof_type' }
  ) {
    type Format = Record<string, Partial<Record<typeof property, string[]>> | undefined> | undefined
    const getValues = (format: Format, designations: string[]) =>
      designations.flatMap((designation) => format?.[designation]?.[property] ?? [])

    const formats = presentationDefinition.input_descriptors.map(
      (inputDescriptor) => (inputDescriptor as InputDescriptorV2).format as Format
    )
    const definitionFormat = presentationDefinition.format as Format

    const required = this.getSigningAlgorithmsForPresentationDefinitionAndInputDescriptors(
      getValues(definitionFormat, presentationFormats),
      formats.map((format) => getValues(format, presentationFormats)).filter((values) => values.length > 0)
    )
    const preferred = [definitionFormat, ...formats].flatMap((format) => getValues(format, credentialFormats))

    return { required, preferred }
  }

  /**
   * The algorithm to sign a JWT VP with: one the `jwt_vp` (or for `jwt_vc_json` credentials `jwt_vp_json`) format
   * allows. Without such a restriction, one the `jwt_vc` (or `jwt_vc_json`) format allows is preferred, and otherwise
   * the default algorithm of the key is used.
   */
  private getSigningAlgorithmForJwtVp(
    presentationDefinition: DifPresentationExchangeDefinitionV1 | DifPresentationExchangeDefinitionV2,
    credentialFormats: string[],
    verificationMethod: VerificationMethod
  ) {
    const { required, preferred } = this.getPresentationFormatRestrictions(presentationDefinition, {
      presentationFormats: [
        ...new Set(credentialFormats.map((format) => (format === 'jwt_vc_json' ? 'jwt_vp_json' : 'jwt_vp'))),
      ],
      credentialFormats,
      property: 'alg',
    })
    if (required) return this.getSigningAlgorithmFromVerificationMethod(verificationMethod, required)

    // The first algorithm the verifier lists that the key supports
    const { supportedSignatureAlgorithms, signatureAlgorithm } = getPublicJwkFromVerificationMethod(verificationMethod)
    const algorithm = preferred
      .map((preferredAlgorithm) => supportedSignatureAlgorithms.find((supported) => supported === preferredAlgorithm))
      .find((supported) => supported !== undefined)

    return algorithm ?? signatureAlgorithm
  }

  /**
   * The proof type to sign an LDP VP with: one the `ldp_vp` format allows. Without such a restriction, one the
   * `ldp_vc` format allows is preferred, and otherwise the first signature suite for the key is used.
   */
  private getProofTypeForLdpVp(
    agentContext: AgentContext,
    presentationDefinition: DifPresentationExchangeDefinitionV1 | DifPresentationExchangeDefinitionV2,
    verificationMethod: VerificationMethod
  ) {
    const { required, preferred } = this.getPresentationFormatRestrictions(presentationDefinition, {
      presentationFormats: ['ldp_vp'],
      credentialFormats: ['ldp_vc'],
      property: 'proof_type',
    })

    const signatureSuiteRegistry = agentContext.dependencyManager.resolve(SignatureSuiteRegistry)
    const publicJwk = getPublicJwkFromVerificationMethod(verificationMethod)
    // The suites that can sign with the verification method: those for its key that accept its type
    const supportedProofTypes = signatureSuiteRegistry
      .getAllByPublicJwkType(publicJwk)
      .filter(({ verificationMethodTypes }) => verificationMethodTypes.includes(verificationMethod.type))
      .map(({ proofType }) => proofType)
    if (supportedProofTypes.length === 0) {
      throw new DifPresentationExchangeError(
        `Couldn't find a supported signature suite for verification method type '${verificationMethod.type}' and jwk ${getJwkHumanDescription(publicJwk.toJson())}`
      )
    }

    if (required) {
      const proofType = supportedProofTypes.find((supported) => required.includes(supported))
      if (!proofType) {
        throw new DifPresentationExchangeError(
          [
            'No possible signature suite found for the given verification method.',
            `Verification method type: ${verificationMethod.type}`,
            `jwk type: ${getJwkHumanDescription(publicJwk.toJson())}`,
            `SupportedSignatureSuites: '${supportedProofTypes.join(', ')}'`,
            `SuitableSignatureSuites: ${required.join(', ')}`,
          ].join('\n')
        )
      }
      return proofType
    }

    return preferred.find((proofType) => supportedProofTypes.includes(proofType)) ?? supportedProofTypes[0]
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
    const [verificationMethod] = didDocument.findVerificationMethodsByPurpose(['authentication'])
    return verificationMethod
  }

  /**
   * Queries the wallet for credentials that match the given presentation definition. This only does an initial query based on the
   * schema of the input descriptors. It does not do any further filtering based on the constraints in the input descriptors.
   */
  private async queryCredentialForPresentationDefinition(
    agentContext: AgentContext,
    parsedDefinition: ParsedPresentationDefinition
  ): Promise<Array<SdJwtVcRecord | W3cCredentialRecord | MdocRecord>> {
    const w3cCredentialRepository = agentContext.dependencyManager.resolve(W3cCredentialRepository)
    const w3cQuery: Array<Query<W3cCredentialRecord>> = []
    const sdJwtVcQuery: Array<Query<SdJwtVcRecord>> = []
    const mdocQuery: Array<Query<MdocRecord>> = []

    // FIXME: in the query we should take into account the supported proof types of the verifier
    // this could help enormously in the amount of credentials we have to retrieve from storage.
    if (parsedDefinition.version === 'v1') {
      // The schema.uri can contain either an expanded type, or a context uri
      for (const inputDescriptor of parsedDefinition.definition.input_descriptors) {
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
    }
    // FIXME: As PE version 2 does not have the `schema` anymore, we can't query by schema anymore.
    // We probably need to find some way to do initial filtering, hopefully if there's a filter on the
    // `type` field or something.

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
