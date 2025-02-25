import type { AgentContext, DifPresentationExchangeDefinitionV2, VerificationMethod } from '@credo-ts/core'

import {
  CREDENTIALS_CONTEXT_V1_URL,
  ClaimFormat,
  W3cCredential,
  W3cCredentialService,
  W3cCredentialSubject,
  W3cIssuer,
  getKeyFromVerificationMethod,
} from '@credo-ts/core'

import { getProofTypeFromKey } from '../src/shared/utils'

export const waltPortalOpenBadgeJwt =
  'eyJ0eXAiOiJKV1QiLCJhbGciOiJFZERTQSIsImtpZCI6ImRpZDprZXk6ejZNa3RpUVFFcW0yeWFwWEJEdDFXRVZCM2RxZ3Z5emk5NkZ1RkFOWW1yZ1RyS1Y5I3o2TWt0aVFRRXFtMnlhcFhCRHQxV0VWQjNkcWd2eXppOTZGdUZBTlltcmdUcktWOSJ9.eyJ2YyI6eyJAY29udGV4dCI6WyJodHRwczovL3d3dy53My5vcmcvMjAxOC9jcmVkZW50aWFscy92MSJdLCJ0eXBlIjpbIlZlcmlmaWFibGVDcmVkZW50aWFsIiwiT3BlbkJhZGdlQ3JlZGVudGlhbCJdLCJjcmVkZW50aWFsU3ViamVjdCI6e319LCJpc3MiOiJkaWQ6a2V5Ono2TWt0aVFRRXFtMnlhcFhCRHQxV0VWQjNkcWd2eXppOTZGdUZBTlltcmdUcktWOSIsInN1YiI6ImRpZDprZXk6ejZNa3BHUjRnczRSYzNacGg0dmo4d1Juam5BeGdBUFN4Y1I4TUFWS3V0V3NwUXpjIiwibmJmIjoxNzAwNzQzMzM1fQ.OcKPyaWeVV-78BWr8N4h2Cyvjtc9jzknAqvTA77hTbKCNCEbhGboo-S6yXHLC-3NWYQ1vVcqZmdPlIOrHZ7MDw'

export const waltUniversityDegreeJwt =
  'eyJ0eXAiOiJKV1QiLCJhbGciOiJFZERTQSIsImtpZCI6ImRpZDprZXk6ejZNa3RpUVFFcW0yeWFwWEJEdDFXRVZCM2RxZ3Z5emk5NkZ1RkFOWW1yZ1RyS1Y5I3o2TWt0aVFRRXFtMnlhcFhCRHQxV0VWQjNkcWd2eXppOTZGdUZBTlltcmdUcktWOSJ9.eyJ2YyI6eyJAY29udGV4dCI6WyJodHRwczovL3d3dy53My5vcmcvMjAxOC9jcmVkZW50aWFscy92MSJdLCJ0eXBlIjpbIlZlcmlmaWFibGVDcmVkZW50aWFsIiwiVW5pdmVyc2l0eURlZ3JlZUNyZWRlbnRpYWwiXSwiY3JlZGVudGlhbFN1YmplY3QiOnt9fSwiaXNzIjoiZGlkOmtleTp6Nk1rdGlRUUVxbTJ5YXBYQkR0MVdFVkIzZHFndnl6aTk2RnVGQU5ZbXJnVHJLVjkiLCJzdWIiOiJkaWQ6a2V5Ono2TWtwR1I0Z3M0UmMzWnBoNHZqOHdSbmpuQXhnQVBTeGNSOE1BVkt1dFdzcFF6YyIsIm5iZiI6MTcwMDc0MzM5NH0.EhMnE349oOvzbu0rFl-m_7FOoRsB5VucLV5tUUIW0jPxkJ7J0qVLOJTXVX4KNv_N9oeP8pgTUvydd6nxB_0KCQ'

export const getOpenBadgeCredentialLdpVc = async (
  agentContext: AgentContext,
  issuerVerificationMethod: VerificationMethod,
  holderVerificationMethod: VerificationMethod
) => {
  const credential = new W3cCredential({
    context: [CREDENTIALS_CONTEXT_V1_URL, 'https://www.w3.org/2018/credentials/examples/v1'],
    type: ['VerifiableCredential', 'OpenBadgeCredential'],
    id: 'http://example.edu/credentials/3732',
    issuer: new W3cIssuer({
      id: issuerVerificationMethod.controller,
    }),
    issuanceDate: '2017-10-22T12:23:48Z',
    expirationDate: '2027-10-22T12:23:48Z',
    credentialSubject: new W3cCredentialSubject({
      id: holderVerificationMethod.controller,
    }),
  })

  const w3cs = agentContext.dependencyManager.resolve(W3cCredentialService)
  const key = getKeyFromVerificationMethod(holderVerificationMethod)
  const proofType = getProofTypeFromKey(agentContext, key)
  const signedLdpVc = await w3cs.signCredential(agentContext, {
    format: ClaimFormat.LdpVc,
    credential,
    verificationMethod: issuerVerificationMethod.id,
    proofType,
  })

  return signedLdpVc
}
export const openBadgeCredentialPresentationDefinitionLdpVc: DifPresentationExchangeDefinitionV2 = {
  id: 'OpenBadgeCredential',
  input_descriptors: [
    {
      id: 'OpenBadgeCredential',
      // changed jwt_vc_json to jwt_vc
      format: { ldp_vc: { proof_type: ['Ed25519Signature2018'] } },
      // changed $.type to $.vc.type
      constraints: {
        fields: [{ path: ['$.type.*', '$.vc.type'], filter: { type: 'string', pattern: 'OpenBadgeCredential' } }],
      },
    },
  ],
}

export const universityDegreePresentationDefinition: DifPresentationExchangeDefinitionV2 = {
  id: 'UniversityDegreeCredential',
  input_descriptors: [
    {
      id: 'UniversityDegree',
      // changed jwt_vc_json to jwt_vc
      format: { jwt_vc: { alg: ['EdDSA'] } },
      // changed $.type to $.vc.type
      constraints: {
        fields: [{ path: ['$.vc.type.*'], filter: { type: 'string', pattern: 'UniversityDegree' } }],
      },
    },
  ],
}

export const openBadgePresentationDefinition: DifPresentationExchangeDefinitionV2 = {
  id: 'OpenBadgeCredential',
  input_descriptors: [
    {
      id: 'OpenBadgeCredentialDescriptor',
      // changed jwt_vc_json to jwt_vc
      format: { jwt_vc: { alg: ['EdDSA'] } },
      // changed $.type to $.vc.type
      constraints: {
        fields: [{ path: ['$.vc.type.*'], filter: { type: 'string', pattern: 'OpenBadgeCredential' } }],
      },
    },
  ],
}

export const combinePresentationDefinitions = (
  presentationDefinitions: DifPresentationExchangeDefinitionV2[]
): DifPresentationExchangeDefinitionV2 => {
  return {
    id: 'Combined',
    input_descriptors: presentationDefinitions.flatMap((p) => p.input_descriptors),
  }
}

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export function waitForMockFunction(mockFn: jest.Mock<any, any, any>) {
  return new Promise((resolve, reject) => {
    const intervalId = setInterval(() => {
      if (mockFn.mock.calls.length > 0) {
        clearInterval(intervalId)
        resolve(0)
      }
    }, 100)

    setTimeout(() => {
      clearInterval(intervalId)
      reject(new Error('Timeout Callback'))
    }, 10000)
  })
}
