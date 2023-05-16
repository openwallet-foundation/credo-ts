import type { AnonCredsCredentialInfo, AnonCredsRequestedAttributeMatch } from '../../models'

import { sortRequestedCredentialsMatches } from '../sortRequestedCredentialsMatches'

const credentialInfo = {} as unknown as AnonCredsCredentialInfo

const credentials: AnonCredsRequestedAttributeMatch[] = [
  {
    credentialId: '1',
    revealed: true,
    revoked: true,
    credentialInfo,
  },
  {
    credentialId: '2',
    revealed: true,
    revoked: undefined,
    credentialInfo,
  },
  {
    credentialId: '3',
    revealed: true,
    revoked: false,
    credentialInfo,
  },
  {
    credentialId: '4',
    revealed: true,
    revoked: false,
    credentialInfo,
  },
  {
    credentialId: '5',
    revealed: true,
    revoked: true,
    credentialInfo,
  },
  {
    credentialId: '6',
    revealed: true,
    revoked: undefined,
    credentialInfo,
  },
]

describe('sortRequestedCredentialsMatches', () => {
  test('sorts the credentials', () => {
    expect(sortRequestedCredentialsMatches(credentials)).toEqual([
      credentials[1],
      credentials[5],
      credentials[2],
      credentials[3],
      credentials[0],
      credentials[4],
    ])
  })
})
