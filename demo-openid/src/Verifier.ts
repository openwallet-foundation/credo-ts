import type {
  ProofResponseHandler,
  CreateProofRequestOptions,
  VerifierEndpointConfig,
  PresentationDefinitionV2,
} from '@aries-framework/openid4vc'
import type e from 'express'

import { AskarModule } from '@aries-framework/askar'
import { SigningAlgo, OpenId4VcVerifierModule, staticOpOpenIdConfig } from '@aries-framework/openid4vc'
import { ariesAskar } from '@hyperledger/aries-askar-nodejs'
import { Router } from 'express'

import { BaseAgent } from './BaseAgent'
import { Output } from './OutputClass'

const universityDegreePresentationDefinition = {
  id: 'UniversityDegreeCredential',
  purpose: 'Present your UniversityDegreeCredential to verify your education level.',
  input_descriptors: [
    {
      id: 'UniversityDegreeCredential',
      // changed jwt_vc_json to jwt_vc
      format: { jwt_vc: { alg: ['EdDSA'] } },
      // changed $.type to $.vc.type
      constraints: {
        fields: [{ path: ['$.vc.type.*'], filter: { type: 'string', pattern: 'UniversityDegree' } }],
      },
    },
  ],
}

const openBadgeCredentialPresentationDefinition = {
  id: 'OpenBadgeCredential',
  purpose: 'Provide proof of employment to confirm your employment status.',
  input_descriptors: [
    {
      id: 'OpenBadgeCredential',
      // changed jwt_vc_json to jwt_vc
      format: { jwt_vc: { alg: ['EdDSA'] } },
      // changed $.type to $.vc.type
      constraints: {
        fields: [{ path: ['$.vc.type.*'], filter: { type: 'string', pattern: 'OpenBadgeCredential' } }],
      },
    },
  ],
}

export const presentationDefinitions = [
  universityDegreePresentationDefinition,
  openBadgeCredentialPresentationDefinition,
]

function getOpenIdVerifierModules() {
  return {
    askar: new AskarModule({ ariesAskar }),
    openId4VcVerifier: new OpenId4VcVerifierModule({
      verifierMetadata: {
        verifierBaseUrl: 'http://localhost:4000',
        verificationEndpointPath: '/verify',
      },
    }),
  } as const
}

export class Verifier extends BaseAgent<ReturnType<typeof getOpenIdVerifierModules>> {
  public constructor(port: number, name: string) {
    super({ port, name, modules: getOpenIdVerifierModules() })
  }

  public static async build(): Promise<Verifier> {
    const verifier = new Verifier(4000, 'OpenId4VcVerifier ' + Math.random().toString())
    await verifier.initializeAgent('96213c3d7fc8d4d6754c7a0fd969598g')

    return verifier
  }

  public async configureVerifierRouter(): Promise<e.Router> {
    const endpointConfig: VerifierEndpointConfig = {
      basePath: '/',
      verificationEndpointConfig: {
        enabled: true,
        proofResponseHandler: Verifier.proofResponseHandler,
      },
    }

    const router = await this.agent.modules.openId4VcVerifier.configureRouter(Router(), endpointConfig)
    this.app.use('/', router)
    return router
  }

  public async createProofRequest(presentationDefinition: PresentationDefinitionV2) {
    const createProofRequestOptions: CreateProofRequestOptions = {
      verificationMethod: this.verificationMethod,
      presentationDefinition,
      holderMetadata: {
        ...staticOpOpenIdConfig,
        idTokenSigningAlgValuesSupported: [SigningAlgo.EDDSA],
        requestObjectSigningAlgValuesSupported: [SigningAlgo.EDDSA],
        vpFormatsSupported: { jwt_vc: { alg: [SigningAlgo.EDDSA] }, jwt_vp: { alg: [SigningAlgo.EDDSA] } },
      },
    }

    const { proofRequest } = await this.agent.modules.openId4VcVerifier.createProofRequest(createProofRequestOptions)

    return proofRequest
  }

  private static proofResponseHandler: ProofResponseHandler = async (payload) => {
    console.log('Received a valid proof response', payload)
    return { status: 200 }
  }

  public async exit() {
    console.log(Output.Exit)
    await this.agent.shutdown()
    process.exit(0)
  }

  public async restart() {
    await this.agent.shutdown()
  }
}
