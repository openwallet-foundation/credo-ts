import type { HolderMetadata } from './OpenId4VcVerifierServiceOptions'

import { ResponseType, Scope, SubjectType, SigningAlgo, PassBy } from '@sphereon/did-auth-siop'

export const siopv2StaticOpConfiguration: HolderMetadata = {
  authorization_endpoint: 'siopv2:',
  subject_syntax_types_supported: ['urn:ietf:params:oauth:jwk-thumbprint'],
  responseTypesSupported: [ResponseType.ID_TOKEN],
  scopesSupported: [Scope.OPENID],
  subjectTypesSupported: [SubjectType.PAIRWISE],
  idTokenSigningAlgValuesSupported: [SigningAlgo.ES256],
  requestObjectSigningAlgValuesSupported: [SigningAlgo.ES256],
  passBy: PassBy.VALUE,
}

export const openidStaticOpConfiguration: HolderMetadata = {
  authorization_endpoint: 'openid:',
  subject_syntax_types_supported: ['urn:ietf:params:oauth:jwk-thumbprint'],
  responseTypesSupported: [ResponseType.ID_TOKEN, ResponseType.VP_TOKEN],
  scopesSupported: [Scope.OPENID],
  subjectTypesSupported: [SubjectType.PAIRWISE],
  idTokenSigningAlgValuesSupported: [SigningAlgo.ES256],
  requestObjectSigningAlgValuesSupported: [SigningAlgo.ES256],
  passBy: PassBy.VALUE,
  vpFormatsSupported: { jwt_vc: { alg: [SigningAlgo.ES256] }, jwt_vp: { alg: [SigningAlgo.ES256] } },
}
