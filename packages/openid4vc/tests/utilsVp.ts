import type { HolderMetadata } from '../src'
import type { PresentationDefinitionV2 } from '@sphereon/pex-models'

import { SigningAlgo } from '@sphereon/did-auth-siop'

import { staticOpOpenIdConfig } from '../src'
import { staticOpSiopConfig } from '../src/openid4vc-verifier/OpenId4VcVerifierServiceOptions'
// id id%22%3A%22test%22%2C%22
// * = %2A
// TODO: error on sphereon lib PR opened
// TODO: walt issued credentials verification fails due to some time issue || //throw new Error(`Inconsistent issuance dates between JWT claim (${nbfDateAsStr}) and VC value (${issuanceDate})`);
// TODO: error walt no id in presentation definition
// TODO: error walt vc.type is an array not a string thus the filter does not work $.type (should be array according to vc data 1.1)
// TODO: jwt_vc vs jwt_vc_json
export const waltPortalOpenBadgeJwt =
  'eyJ0eXAiOiJKV1QiLCJhbGciOiJFZERTQSIsImtpZCI6ImRpZDprZXk6ejZNa3RpUVFFcW0yeWFwWEJEdDFXRVZCM2RxZ3Z5emk5NkZ1RkFOWW1yZ1RyS1Y5I3o2TWt0aVFRRXFtMnlhcFhCRHQxV0VWQjNkcWd2eXppOTZGdUZBTlltcmdUcktWOSJ9.eyJ2YyI6eyJAY29udGV4dCI6WyJodHRwczovL3d3dy53My5vcmcvMjAxOC9jcmVkZW50aWFscy92MSJdLCJ0eXBlIjpbIlZlcmlmaWFibGVDcmVkZW50aWFsIiwiT3BlbkJhZGdlQ3JlZGVudGlhbCJdLCJjcmVkZW50aWFsU3ViamVjdCI6e319LCJpc3MiOiJkaWQ6a2V5Ono2TWt0aVFRRXFtMnlhcFhCRHQxV0VWQjNkcWd2eXppOTZGdUZBTlltcmdUcktWOSIsInN1YiI6ImRpZDprZXk6ejZNa3BHUjRnczRSYzNacGg0dmo4d1Juam5BeGdBUFN4Y1I4TUFWS3V0V3NwUXpjIiwibmJmIjoxNzAwNzQzMzM1fQ.OcKPyaWeVV-78BWr8N4h2Cyvjtc9jzknAqvTA77hTbKCNCEbhGboo-S6yXHLC-3NWYQ1vVcqZmdPlIOrHZ7MDw'

export const waltUniversityDegreeJwt =
  'eyJ0eXAiOiJKV1QiLCJhbGciOiJFZERTQSIsImtpZCI6ImRpZDprZXk6ejZNa3RpUVFFcW0yeWFwWEJEdDFXRVZCM2RxZ3Z5emk5NkZ1RkFOWW1yZ1RyS1Y5I3o2TWt0aVFRRXFtMnlhcFhCRHQxV0VWQjNkcWd2eXppOTZGdUZBTlltcmdUcktWOSJ9.eyJ2YyI6eyJAY29udGV4dCI6WyJodHRwczovL3d3dy53My5vcmcvMjAxOC9jcmVkZW50aWFscy92MSJdLCJ0eXBlIjpbIlZlcmlmaWFibGVDcmVkZW50aWFsIiwiVW5pdmVyc2l0eURlZ3JlZUNyZWRlbnRpYWwiXSwiY3JlZGVudGlhbFN1YmplY3QiOnt9fSwiaXNzIjoiZGlkOmtleTp6Nk1rdGlRUUVxbTJ5YXBYQkR0MVdFVkIzZHFndnl6aTk2RnVGQU5ZbXJnVHJLVjkiLCJzdWIiOiJkaWQ6a2V5Ono2TWtwR1I0Z3M0UmMzWnBoNHZqOHdSbmpuQXhnQVBTeGNSOE1BVkt1dFdzcFF6YyIsIm5iZiI6MTcwMDc0MzM5NH0.EhMnE349oOvzbu0rFl-m_7FOoRsB5VucLV5tUUIW0jPxkJ7J0qVLOJTXVX4KNv_N9oeP8pgTUvydd6nxB_0KCQ'

export const universityDegreePresentationDefinition: PresentationDefinitionV2 = {
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

export const openBadgePresentationDefinition: PresentationDefinitionV2 = {
  id: 'OpenBadgeCredential',
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

export const combinePresentationDefinitions = (
  presentationDefinitions: PresentationDefinitionV2[]
): PresentationDefinitionV2 => {
  return {
    id: 'Combined',
    input_descriptors: presentationDefinitions.flatMap((p) => p.input_descriptors),
  }
}

export const staticOpOpenIdConfigEdDSA: HolderMetadata = {
  ...staticOpOpenIdConfig,
  idTokenSigningAlgValuesSupported: [SigningAlgo.EDDSA],
  requestObjectSigningAlgValuesSupported: [SigningAlgo.EDDSA],
  vpFormatsSupported: { jwt_vc: { alg: [SigningAlgo.EDDSA] }, jwt_vp: { alg: [SigningAlgo.EDDSA] } },
}

export const staticSiopConfigEDDSA: HolderMetadata = {
  ...staticOpSiopConfig,
  idTokenSigningAlgValuesSupported: [SigningAlgo.EDDSA],
  requestObjectSigningAlgValuesSupported: [SigningAlgo.EDDSA],
  vpFormatsSupported: { jwt_vc: { alg: [SigningAlgo.EDDSA] }, jwt_vp: { alg: [SigningAlgo.EDDSA] } },
}

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
