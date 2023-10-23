import type { CredentialsForInputDescriptor, PresentationSubmission } from './selection/types'
import type {
  AgentContext,
  Query,
  VerificationMethod,
  W3cCredentialRecord,
  W3cVerifiableCredential,
} from '@aries-framework/core'
import type { PresentationSignCallBackParams, VerifiablePresentationResult } from '@sphereon/pex'
import type {
  PresentationDefinitionV1,
  PresentationDefinitionV2,
  PresentationSubmission as PexPresentationSubmission,
  Descriptor,
} from '@sphereon/pex-models'
import type { IVerifiablePresentation } from '@sphereon/ssi-types'

import {
  AriesFrameworkError,
  ClaimFormat,
  DidsApi,
  getJwkFromKey,
  getKeyFromVerificationMethod,
  injectable,
  JsonTransformer,
  utils,
  W3cCredentialService,
  W3cPresentation,
  W3cCredentialRepository,
} from '@aries-framework/core'
import { PEVersion, PEX, Status } from '@sphereon/pex'

import { selectCredentialsForRequest } from './selection/PexCredentialSelection'
import {
  getSphereonW3cVerifiableCredential,
  getSphereonW3cVerifiablePresentation,
  getW3cVerifiablePresentationInstance,
} from './transform'

@injectable()
export class PresentationExchangeService {
  private pex = new PEX()

  /**
   * Validates a DIF Presentation Definition
   */
  public validateDefinition(presentationDefinition: PresentationDefinitionV1) {
    const result = PEX.validateDefinition(presentationDefinition)

    // check if error
    const firstResult = Array.isArray(result) ? result[0] : result

    if (firstResult.status !== Status.INFO) {
      throw new AriesFrameworkError(
        `Error in presentation exchange presentationDefinition: ${firstResult?.message ?? 'Unknown'} `
      )
    }
  }

  public evaluatePresentation({
    presentationDefinition,
    presentation,
  }: {
    presentationDefinition: PresentationDefinitionV1
    presentation: IVerifiablePresentation
  }) {
    // validate contents of presentation
    const evaluationResults = this.pex.evaluatePresentation(presentationDefinition, presentation)

    return evaluationResults
  }

  public async selectCredentialsForRequest(
    agentContext: AgentContext,
    presentationDefinition: PresentationDefinitionV1
  ): Promise<PresentationSubmission> {
    const credentialRecords = await this.queryCredentialForPresentationDefinition(agentContext, presentationDefinition)

    return selectCredentialsForRequest(presentationDefinition, credentialRecords)
  }

  public async createPresentation(
    agentContext: AgentContext,
    {
      credentialsForInputDescriptor,
      presentationDefinition,
      challenge,
      domain,
      nonce,
      includePresentationSubmissionInVp = true,
    }: {
      credentialsForInputDescriptor: CredentialsForInputDescriptor
      presentationDefinition: PresentationDefinitionV1 | PresentationDefinitionV2
      challenge?: string
      domain?: string
      nonce?: string
      includePresentationSubmissionInVp?: boolean
    }
  ) {
    // if (selectedCredentials.length === 0) {
    //   throw new AriesFrameworkError('No credentials selected for creating presentation.')
    // }

    const vps: {
      [subjectId: string]: {
        [inputDescriptorId: string]: W3cVerifiableCredential[]
      }
    } = {}

    const verifiablePresentationResults: VerifiablePresentationResult[] = []

    Object.entries(credentialsForInputDescriptor).forEach(([inputDescriptorId, credentials]) => {
      credentials.forEach((credential) => {
        const firstCredentialSubjectId = credential.credentialSubjectIds[0]
        if (!firstCredentialSubjectId) {
          throw new AriesFrameworkError(
            'Credential subject missing from the selected credential for creating presentation.'
          )
        }

        const inputDescriptorsForSubject = vps[firstCredentialSubjectId] ?? {}
        vps[firstCredentialSubjectId] = inputDescriptorsForSubject

        const credentialsForInputDescriptor = inputDescriptorsForSubject[inputDescriptorId] ?? []
        inputDescriptorsForSubject[inputDescriptorId] = credentialsForInputDescriptor

        credentialsForInputDescriptor.push(credential)
      })
    })

    for (const [subjectId, inputDescriptors] of Object.entries(vps)) {
      // Determine a suitable verification method for the presentation
      const verificationMethod = await this.getVerificationMethodForSubjectId(agentContext, subjectId)

      if (!verificationMethod) {
        throw new AriesFrameworkError(`No verification method found for subject id ${subjectId}`)
      }

      const inputDescriptorsForVp = (presentationDefinition.input_descriptors as PresentationDefinitionV1[]).filter(
        (inputDescriptor) => inputDescriptor.id in inputDescriptors
      )

      const credentialsForVp = Object.values(inputDescriptors)
        .flatMap((inputDescriptors) => inputDescriptors)
        .map(getSphereonW3cVerifiableCredential)

      const presentationDefinitionForVp = {
        ...presentationDefinition,
        input_descriptors: inputDescriptorsForVp,

        // We remove the submission requirements, as it will otherwise fail to create the VP
        // FIXME: Will this cause issue for creating the credential? Need to run tests
        submission_requirements: undefined,
      }

      // Q1: is holder always subject id, what if there are multiple subjects???
      // Q2: What about proofType, proofPurpose verification method for multiple subjects?
      const verifiablePresentationResult = await this.pex.verifiablePresentationFrom(
        presentationDefinitionForVp,
        credentialsForVp,
        this.getPresentationSignCallback(
          agentContext,
          verificationMethod,
          // Can't include submission if more than one VP
          Object.values(vps).length > 1 ? false : includePresentationSubmissionInVp
        ),
        {
          holderDID: subjectId,
          proofOptions: {
            challenge,
            domain,
            nonce,
          },
          signatureOptions: {
            verificationMethod: verificationMethod?.id,
          },
        }
      )

      verifiablePresentationResults.push(verifiablePresentationResult)
    }

    const firstVerifiablePresentationResult = verifiablePresentationResults[0]
    if (!firstVerifiablePresentationResult) {
      throw new AriesFrameworkError('No verifiable presentations created.')
    }

    const presentationSubmission: PexPresentationSubmission = {
      id: firstVerifiablePresentationResult.presentationSubmission.id,
      definition_id: firstVerifiablePresentationResult.presentationSubmission.definition_id,
      descriptor_map: [],
    }

    for (const vp of verifiablePresentationResults) {
      presentationSubmission.descriptor_map.push(
        ...vp.presentationSubmission.descriptor_map.map((descriptor): Descriptor => {
          const index = verifiablePresentationResults.indexOf(vp)
          const prefix = verifiablePresentationResults.length > 1 ? `$[${index}]` : '$'
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
      presentationSubmissionLocation: firstVerifiablePresentationResult.presentationSubmissionLocation,
    }
  }

  public getPresentationSignCallback(
    agentContext: AgentContext,
    verificationMethod: VerificationMethod,
    includePresentationSubmissionInVp = true
  ) {
    const w3cCredentialService = agentContext.dependencyManager.resolve(W3cCredentialService)

    return async (callBackParams: PresentationSignCallBackParams) => {
      // The created partial proof and presentation, as well as original supplied options
      const { presentation: presentationJson, options } = callBackParams
      const { challenge, domain, nonce } = options.proofOptions ?? {}
      const { verificationMethod: verificationMethodId } = options.signatureOptions ?? {}

      let presentationToSignJson = presentationJson
      if (!includePresentationSubmissionInVp) {
        presentationToSignJson = {
          ...presentationToSignJson,
          presentation_submission: undefined,
        }
      }
      const w3cPresentation = JsonTransformer.fromJSON(presentationToSignJson, W3cPresentation)

      if (verificationMethodId && verificationMethodId !== verificationMethod.id) {
        throw new AriesFrameworkError(
          `Verification method from signing options ${verificationMethodId} does not match verification method ${verificationMethod.id}.`
        )
      }

      // NOTE: we currently don't support mixed presentations, where some credentials
      // are JWT and some are JSON-LD. It could be however that the presentation contains
      // some JWT and some JSON-LD credentials. (for DDIP we only support JWT, so we should be fine)
      const isJwt = typeof presentationJson.verifiableCredential?.[0] === 'string'

      if (!isJwt) {
        throw new AriesFrameworkError(`Only JWT credentials are supported for presentation exchange.`)
      }

      const key = getKeyFromVerificationMethod(verificationMethod)
      const jwk = getJwkFromKey(key)

      const alg = jwk.supportedSignatureAlgorithms[0]
      if (!alg) {
        throw new AriesFrameworkError(`No supported algs for key type: ${key.keyType}`)
      }

      const signedPresentation = await w3cCredentialService.signPresentation(agentContext, {
        format: ClaimFormat.JwtVp,
        verificationMethod: verificationMethod.id,
        presentation: w3cPresentation,
        alg,
        challenge: challenge ?? nonce ?? utils.uuid(),
        domain,
      })

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

  /**
   * Queries the wallet for credentials that match the given presentation definition. This only does an initial query based on the
   * schema of the input descriptors. It does not do any further filtering based on the constraints in the input descriptors.
   */
  private async queryCredentialForPresentationDefinition(
    agentContext: AgentContext,
    presentationDefinition: PresentationDefinitionV1 | PresentationDefinitionV2
  ) {
    const w3cCredentialRepository = agentContext.dependencyManager.resolve(W3cCredentialRepository)

    const query: Array<Query<W3cCredentialRecord>> = []

    const presentationDefinitionVersion = PEX.definitionVersionDiscovery(presentationDefinition)

    if (!presentationDefinitionVersion.version) {
      throw new AriesFrameworkError(
        `Unable to determine version for presentation definition. ${
          presentationDefinitionVersion.error ?? 'Unknown error'
        }`
      )
    }

    if (presentationDefinitionVersion.version === PEVersion.v1) {
      const pd = presentationDefinition as PresentationDefinitionV1

      // The schema.uri can contain either an expanded type, or a context uri
      for (const inputDescriptor of pd.input_descriptors) {
        for (const schema of inputDescriptor.schema) {
          // FIXME: It's currently not possible to query by the `type` of the credential. So we fetch all JWT VCs for now
          query.push({
            $or: [{ expandedType: [schema.uri] }, { contexts: [schema.uri] }, { claimFormat: ClaimFormat.JwtVc }],
          })
        }
      }
    } else if (presentationDefinitionVersion.version === PEVersion.v2) {
      // FIXME: As PE version 2 does not have the `schema` anymore, we can't query by schema anymore.
      // For now we retrieve ALL credentials, as we did the same for V1 with JWT credentials. We probably need
      // to find some way to do initial filtering, hopefully if there's a filter on the `type` field or something.

      // FIXME: It's currently not possible to query by the `type` of the credential. So we fetch all JWT VCs for now
      query.push({
        $or: [{ claimFormat: ClaimFormat.JwtVc }],
      })
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
}
