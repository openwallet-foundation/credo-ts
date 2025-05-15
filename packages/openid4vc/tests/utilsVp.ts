import type { DifPresentationExchangeDefinitionV2 } from '@credo-ts/core'

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
