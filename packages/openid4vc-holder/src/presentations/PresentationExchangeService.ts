import type { PresentationSubmission } from './selection/types'
import type {
  AgentContext,
  Query,
  VerificationMethod,
  W3cCredentialRecord,
  W3cVerifiableCredential,
} from '@aries-framework/core'
import type { PresentationSignCallBackParams } from '@sphereon/pex'
import type { PresentationDefinitionV1 } from '@sphereon/pex-models'
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
import { PEXv1, Status } from '@sphereon/pex'

import { selectCredentialsForRequest } from './selection/PexCredentialSelection'
import {
  getSphereonW3cVerifiableCredential,
  getSphereonW3cVerifiablePresentation,
  getW3cVerifiablePresentationInstance,
} from './transform'

@injectable()
export class PresentationExchangeService {
  private pex = new PEXv1()

  /**
   * Validates a DIF Presentation Definition
   */
  public validateDefinition(presentationDefinition: PresentationDefinitionV1) {
    const result = PEXv1.validateDefinition(presentationDefinition)

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
      selectedCredentials,
      presentationDefinition,
      challenge,
      domain,
    }: {
      selectedCredentials: W3cVerifiableCredential[]
      presentationDefinition: PresentationDefinitionV1
      challenge?: string
      domain?: string
    }
  ) {
    if (selectedCredentials.length === 0) {
      throw new AriesFrameworkError('No credentials selected for creating presentation.')
    }

    // We use the subject id to resolve the DID document.
    // I am assuming the subject is the same for all credentials (for now)
    // The presentation contains multiple credentials and these are being added
    // TODO how do we derive the verification method if there are multiple subject Ids
    // FIXME
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const [firstSubjectId] = selectedCredentials[0]?.credentialSubjectIds ?? []

    // Credential is allowed to be presented without a subject id. In that case we can't prove ownership of credential
    // And it is more like a bearer token.
    // In the future we can first check the holder key and if it exists we can use that as the one that should authenticate
    // https://www.w3.org/TR/vc-data-model/#example-a-credential-issued-to-a-holder-who-is-not-the-only-subject-of-the-credential-who-has-no-relationship-with-the-subject-of-the-credential-but-who-has-a-relationship-with-the-issuer
    if (!firstSubjectId) {
      throw new AriesFrameworkError(
        'Credential subject missing from the selected credential for creating presentation.'
      )
    }

    // Determine a suitable verification method for the presentation
    const verificationMethod = await this.getVerificationMethodForSubjectId(agentContext, firstSubjectId)

    if (!verificationMethod) {
      throw new AriesFrameworkError(`No verification method found for subject id ${firstSubjectId}`)
    }

    // Q1: is holder always subject id, what if there are multiple subjects???
    // Q2: What about proofType, proofPurpose verification method for multiple subjects?
    const verifiablePresentationResult = await this.pex.verifiablePresentationFrom(
      presentationDefinition,
      selectedCredentials.map(getSphereonW3cVerifiableCredential),
      this.getPresentationSignCallback(agentContext, verificationMethod),
      {
        holderDID: firstSubjectId,
        proofOptions: {
          challenge,
          domain,
          // TODO: add nonce
        },
        signatureOptions: {
          verificationMethod: verificationMethod?.id,
        },
      }
    )

    return {
      verifiablePresentation: getW3cVerifiablePresentationInstance(verifiablePresentationResult.verifiablePresentation),
      presentationSubmission: verifiablePresentationResult.presentationSubmission,
      presentationSubmissionLocation: verifiablePresentationResult.presentationSubmissionLocation,
    }
  }

  public getPresentationSignCallback(agentContext: AgentContext, verificationMethod: VerificationMethod) {
    const w3cCredentialService = agentContext.dependencyManager.resolve(W3cCredentialService)

    return async (callBackParams: PresentationSignCallBackParams) => {
      // The created partial proof and presentation, as well as original supplied options
      const { presentation: presentationJson, options } = callBackParams
      const { challenge, domain, nonce } = options.proofOptions ?? {}
      const { verificationMethod: verificationMethodId } = options.signatureOptions ?? {}

      const w3cPresentation = JsonTransformer.fromJSON(presentationJson, W3cPresentation)

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
    presentationDefinition: PresentationDefinitionV1
  ) {
    const w3cCredentialRepository = agentContext.dependencyManager.resolve(W3cCredentialRepository)

    const query: Array<Query<W3cCredentialRecord>> = []

    // The schema.uri can contain either an expanded type, or a context uri
    for (const inputDescriptor of presentationDefinition.input_descriptors) {
      for (const schema of inputDescriptor.schema) {
        // FIXME: It's currently not possible to query by the `type` of the credential. So we fetch all JWT VCs for now
        query.push({
          $or: [{ expandedType: [schema.uri] }, { contexts: [schema.uri] }, { claimFormat: ClaimFormat.JwtVc }],
        })
      }
    }

    // query the wallet ourselves first to avoid the need to query the pex library for all
    // credentials for every proof request
    const credentialRecords = await w3cCredentialRepository.findByQuery(agentContext, {
      $or: query,
    })

    return credentialRecords
  }
}
