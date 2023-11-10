import type { InputDescriptorToCredentials, PresentationSubmission } from './selection/types'
import type {
  AgentContext,
  Query,
  VerificationMethod,
  W3cCredentialRecord,
  W3cVerifiableCredential,
  W3cVerifiablePresentation,
} from '@aries-framework/core'
import type {
  IPresentationDefinition,
  PresentationSignCallBackParams,
  VerifiablePresentationResult,
} from '@sphereon/pex'
import type {
  PresentationDefinitionV1,
  PresentationSubmission as PexPresentationSubmission,
  Descriptor,
} from '@sphereon/pex-models'

import {
  AriesFrameworkError,
  ClaimFormat,
  DidsApi,
  getJwkFromKey,
  getKeyFromVerificationMethod,
  injectable,
  JsonTransformer,
  W3cCredentialService,
  W3cPresentation,
  W3cCredentialRepository,
} from '@aries-framework/core'
import { PEVersion, PEX } from '@sphereon/pex'

import { selectCredentialsForRequest } from './selection/PexCredentialSelection'
import {
  getSphereonW3cVerifiableCredential,
  getSphereonW3cVerifiablePresentation,
  getW3cVerifiablePresentationInstance,
} from './transform'

type ProofStructure = {
  [subjectId: string]: {
    [inputDescriptorId: string]: W3cVerifiableCredential[]
  }
}

@injectable()
export class PresentationExchangeService {
  private pex = new PEX()

  public async selectCredentialsForRequest(
    agentContext: AgentContext,
    presentationDefinition: IPresentationDefinition
  ): Promise<PresentationSubmission> {
    const credentialRecords = await this.queryCredentialForPresentationDefinition(agentContext, presentationDefinition)

    const didsApi = agentContext.dependencyManager.resolve(DidsApi)
    const didRecords = await didsApi.getCreatedDids()
    const holderDIDs = didRecords.map((didRecord) => didRecord.did)

    return selectCredentialsForRequest(presentationDefinition, credentialRecords, holderDIDs)
  }

  /**
   * Queries the wallet for credentials that match the given presentation definition. This only does an initial query based on the
   * schema of the input descriptors. It does not do any further filtering based on the constraints in the input descriptors.
   */
  private async queryCredentialForPresentationDefinition(
    agentContext: AgentContext,
    presentationDefinition: IPresentationDefinition
  ) {
    const w3cCredentialRepository = agentContext.dependencyManager.resolve(W3cCredentialRepository)
    const query: Array<Query<W3cCredentialRecord>> = []
    const presentationDefinitionVersion = PEX.definitionVersionDiscovery(presentationDefinition)

    if (!presentationDefinitionVersion.version) {
      throw new AriesFrameworkError(
        `Unable to determine the Presentation Exchange version from the presentation definition. ${
          presentationDefinitionVersion.error ?? 'Unknown error'
        }`
      )
    }

    if (presentationDefinitionVersion.version === PEVersion.v1) {
      const pd = presentationDefinition as PresentationDefinitionV1

      // The schema.uri can contain either an expanded type, or a context uri
      for (const inputDescriptor of pd.input_descriptors) {
        for (const schema of inputDescriptor.schema) {
          // TODO: write migration
          query.push({
            $or: [{ expandedType: [schema.uri] }, { contexts: [schema.uri] }, { type: [schema.uri] }],
          })
        }
      }
    } else if (presentationDefinitionVersion.version === PEVersion.v2) {
      // FIXME: As PE version 2 does not have the `schema` anymore, we can't query by schema anymore.
      // For now we retrieve ALL credentials, as we did the same for V1 with JWT credentials. We probably need
      // to find some way to do initial filtering, hopefully if there's a filter on the `type` field or something.
    } else {
      throw new AriesFrameworkError(
        `Unsupported presentation definition version ${presentationDefinitionVersion.version as unknown as string}`
      )
    }

    // query the wallet ourselves first to avoid the need to query the pex library for all
    // credentials for every proof request
    const credentialRecords = await w3cCredentialRepository.findByQuery(agentContext, {
      $or: query,
    })

    return credentialRecords
  }

  private addCredentialForSubjectWithInputDescriptorId(
    subjectsToInputDescriptors: ProofStructure,
    subjectId: string,
    inputDescriptorId: string,
    credential: W3cVerifiableCredential
  ) {
    const inputDescriptorsToCredentials = subjectsToInputDescriptors[subjectId] ?? {}
    const credentials = inputDescriptorsToCredentials[inputDescriptorId] ?? []

    credentials.push(credential)
    inputDescriptorsToCredentials[inputDescriptorId] = credentials
    subjectsToInputDescriptors[subjectId] = inputDescriptorsToCredentials
  }

  public async createPresentation(
    agentContext: AgentContext,
    options: {
      credentialsForInputDescriptor: InputDescriptorToCredentials
      presentationDefinition: IPresentationDefinition
      challenge?: string
      domain?: string
      nonce?: string
    }
  ) {
    const { presentationDefinition, challenge, nonce, domain } = options

    const proofStructure: ProofStructure = {}

    Object.entries(options.credentialsForInputDescriptor).forEach(([inputDescriptorId, credentials]) => {
      credentials.forEach((credential) => {
        const subjectId = credential.credentialSubjectIds[0]
        if (!subjectId) {
          throw new AriesFrameworkError('Missing required credential subject for creating the presentation.')
        }

        this.addCredentialForSubjectWithInputDescriptorId(proofStructure, subjectId, inputDescriptorId, credential)
      })
    })

    const verifiablePresentationResults: VerifiablePresentationResult[] = []

    const subjectToInputDescriptors = Object.entries(proofStructure)
    for (const [subjectId, inputDescriptorsToCredentials] of subjectToInputDescriptors) {
      // Determine a suitable verification method for the presentation
      const verificationMethod = await this.getVerificationMethodForSubjectId(agentContext, subjectId)

      if (!verificationMethod) {
        throw new AriesFrameworkError(`No verification method found for subject id '${subjectId}'.`)
      }

      // We create a presentation for each subject
      // Thus for each subject we need to filter all the related input descriptors and credentials
      // FIXME: cast to V1, as tsc errors for strange reasons if not
      const inputDescriptorsForVp = (presentationDefinition as PresentationDefinitionV1).input_descriptors.filter(
        (inputDescriptor) => inputDescriptor.id in inputDescriptorsToCredentials
      )

      // Get all the credentials associated with the input descriptors
      const credentialsForVp = Object.values(inputDescriptorsToCredentials)
        .flatMap((inputDescriptors) => inputDescriptors)
        .map(getSphereonW3cVerifiableCredential)

      const presentationDefinitionForVp: IPresentationDefinition = {
        ...presentationDefinition,
        input_descriptors: inputDescriptorsForVp,

        // We remove the submission requirements, as it will otherwise fail to create the VP
        // FIXME: Will this cause issue for creating the credential? Need to run tests
        submission_requirements: undefined,
      }

      // FIXME: Q1: is holder always subject id, what if there are multiple subjects???
      // FIXME: Q2: What about proofType, proofPurpose verification method for multiple subjects?
      const verifiablePresentationResult = await this.pex.verifiablePresentationFrom(
        presentationDefinitionForVp,
        credentialsForVp,
        this.getPresentationSignCallback(agentContext, verificationMethod),
        {
          holderDID: subjectId,
          proofOptions: { challenge, domain, nonce },
          signatureOptions: { verificationMethod: verificationMethod?.id },
        }
      )

      verifiablePresentationResults.push(verifiablePresentationResult)
    }

    if (subjectToInputDescriptors.length !== verifiablePresentationResults.length) {
      if (!verifiablePresentationResults[0]) throw new AriesFrameworkError('No verifiable presentations created.')
      throw new AriesFrameworkError('Invalid amount of verifiable presentations created.')
    }

    const presentationSubmission: PexPresentationSubmission = {
      id: verifiablePresentationResults[0].presentationSubmission.id,
      definition_id: verifiablePresentationResults[0].presentationSubmission.definition_id,
      descriptor_map: [],
    }

    for (const vp of verifiablePresentationResults) {
      presentationSubmission.descriptor_map.push(
        ...vp.presentationSubmission.descriptor_map.map((descriptor): Descriptor => {
          const index = verifiablePresentationResults.indexOf(vp)
          const prefix = verifiablePresentationResults.length > 1 ? `$[${index}]` : '$'
          // TODO: use enum instead opf jwt_vp | jwt_vc_json
          return {
            format: 'jwt_vp',
            path: prefix,
            id: descriptor.id,
            path_nested: {
              ...descriptor,
              path: descriptor.path.replace('$.', `${prefix}.vp.`),
              format: 'jwt_vc_json',
            },
          }
        })
      )
    }

    return {
      verifiablePresentations: verifiablePresentationResults.map((r) =>
        getW3cVerifiablePresentationInstance(r.verifiablePresentation)
      ),
      presentationSubmission,
      presentationSubmissionLocation: verifiablePresentationResults[0].presentationSubmissionLocation,
    }
  }

  private getSigningAlgorithmFromVerificationMethod(
    verificationMethod: VerificationMethod,
    suitableAlgorithms?: string[]
  ) {
    const key = getKeyFromVerificationMethod(verificationMethod)
    const jwk = getJwkFromKey(key)

    if (suitableAlgorithms) {
      const possibleAlgorithms = jwk.supportedSignatureAlgorithms.filter((alg) => suitableAlgorithms?.includes(alg))
      if (!possibleAlgorithms || possibleAlgorithms.length === 0) {
        throw new AriesFrameworkError(
          [
            `Found no suitable signing algorithm.`,
            `Algorithms supported by Verification method: ${jwk.supportedSignatureAlgorithms.join(', ')}`,
            `Suitable algorithms: ${suitableAlgorithms.join(', ')}`,
          ].join('\n')
        )
      }
    }

    const alg = jwk.supportedSignatureAlgorithms[0]
    if (!alg) throw new AriesFrameworkError(`No supported algs for key type: ${key.keyType}`)
    return alg
  }

  private getSigningAlgorithmForJwtVc(
    presentationDefinition: IPresentationDefinition,
    verificationMethod: VerificationMethod
  ) {
    const suitableAlgorithms = presentationDefinition.format?.jwt_vc?.alg
    // const inputDescriptors: InputDescriptorV2[] = presentationDefinition.input_descriptors as InputDescriptorV2[]

    // TODO: continue

    // const inputDescriptorAlgorithms: string[][] = inputDescriptors
    //   .map((inputDescriptor) => inputDescriptor.format?.jwt_vc?.alg)
    //   .filter((alg): alg is string[] => alg !== undefined && alg.length === 0)

    // const allInputDescriptorAlgorithms = inputDescriptorAlgorithms.flat()

    // const isAlgInEveryInputDescriptor = inputDescriptorAlgorithms.every((alg, _, arr) => arr.includes(alg))

    return this.getSigningAlgorithmFromVerificationMethod(verificationMethod, suitableAlgorithms)
  }

  private getSigningAlgorithmForLdpVc(
    presentationDefinition: IPresentationDefinition,
    verificationMethod: VerificationMethod
  ) {
    const suitableSignaturesSuites = presentationDefinition.format?.ldp_vc?.proof_type
    // TODO: find out which signature suites are supported by the verification method
    // TODO: check if a supported signature suite is in the list of suitable signature suites
    // TODO: remake this after
    if (!suitableSignaturesSuites || suitableSignaturesSuites.length === 0)
      throw new AriesFrameworkError(`No suitable signature suite found for presentation definition.`)

    return suitableSignaturesSuites[0]
  }

  public getPresentationSignCallback(agentContext: AgentContext, verificationMethod: VerificationMethod) {
    const w3cCredentialService = agentContext.dependencyManager.resolve(W3cCredentialService)

    return async (callBackParams: PresentationSignCallBackParams) => {
      // The created partial proof and presentation, as well as original supplied options
      const { presentation: presentationJson, options, presentationDefinition } = callBackParams
      const { challenge, domain, nonce } = options.proofOptions ?? {}
      const { verificationMethod: verificationMethodId } = options.signatureOptions ?? {}

      if (verificationMethodId && verificationMethodId !== verificationMethod.id) {
        throw new AriesFrameworkError(
          `Verification method from signing options ${verificationMethodId} does not match verification method ${verificationMethod.id}.`
        )
      }

      const allJwt = presentationJson.verifiableCredential?.every((c) => typeof c === 'string')
      const allJsonLd = presentationJson.verifiableCredential?.every((c) => typeof c !== 'string')

      // Clients MUST ignore any presentation_submission element included inside a Verifiable Presentation.
      const presentationToSign = { ...presentationJson, presentation_submission: undefined }

      let signedPresentation: W3cVerifiablePresentation<ClaimFormat.JwtVp | ClaimFormat.LdpVp>
      if (allJwt) {
        signedPresentation = await w3cCredentialService.signPresentation(agentContext, {
          format: ClaimFormat.JwtVp,
          verificationMethod: verificationMethod.id,
          presentation: JsonTransformer.fromJSON(presentationToSign, W3cPresentation),
          alg: this.getSigningAlgorithmForJwtVc(presentationDefinition, verificationMethod),
          challenge: challenge ?? nonce ?? (await agentContext.wallet.generateNonce()),
          domain,
        })
      } else if (allJsonLd) {
        signedPresentation = await w3cCredentialService.signPresentation(agentContext, {
          format: ClaimFormat.LdpVp,
          proofType: this.getSigningAlgorithmForLdpVc(presentationDefinition, verificationMethod),
          proofPurpose: 'assertionMethod', // TODO:
          verificationMethod: verificationMethod.id,
          presentation: JsonTransformer.fromJSON(presentationToSign, W3cPresentation),
          challenge: challenge ?? nonce ?? (await agentContext.wallet.generateNonce()),
          domain,
        })
      } else {
        throw new AriesFrameworkError(
          `Only JWT credentials or JSONLD credentials are supported for a single presentation.`
        )
      }

      return getSphereonW3cVerifiablePresentation(signedPresentation)
    }
  }

  private async getVerificationMethodForSubjectId(agentContext: AgentContext, subjectId: string) {
    const didsApi = agentContext.dependencyManager.resolve(DidsApi)

    if (!subjectId.startsWith('did:')) {
      throw new AriesFrameworkError(`Only dids are supported as credentialSubject id. ${subjectId} is not a valid did`)
    }

    const didDocument = await didsApi.resolveDidDocument(subjectId)

    if (!didDocument.authentication || didDocument.authentication.length === 0) {
      throw new AriesFrameworkError(`No authentication verificationMethods found for did ${subjectId} in did document`)
    }

    // the signature suite to use for the presentation is dependant on the credentials we share.
    // 1. Get the verification method for this given proof purpose in this DID document
    let [verificationMethod] = didDocument.authentication
    if (typeof verificationMethod === 'string') {
      verificationMethod = didDocument.dereferenceKey(verificationMethod, ['authentication'])
    }

    return verificationMethod
  }
}
