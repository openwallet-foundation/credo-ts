import { RequestedAttribute } from '../../models'
import { sortRequestedCredentials } from '../sortRequestedCredentials'

const credentials = [
  new RequestedAttribute({
    credentialId: '1',
    revealed: true,
    revoked: true,
  }),
  new RequestedAttribute({
    credentialId: '2',
    revealed: true,
    revoked: undefined,
  }),
  new RequestedAttribute({
    credentialId: '3',
    revealed: true,
    revoked: false,
  }),
  new RequestedAttribute({
    credentialId: '4',
    revealed: true,
    revoked: false,
  }),
  new RequestedAttribute({
    credentialId: '5',
    revealed: true,
    revoked: true,
  }),
  new RequestedAttribute({
    credentialId: '6',
    revealed: true,
    revoked: undefined,
  }),
]

describe('sortRequestedCredentials', () => {
  test('sorts the credentials', () => {
    expect(sortRequestedCredentials(credentials)).toEqual([
      credentials[1],
      credentials[5],
      credentials[2],
      credentials[3],
      credentials[0],
      credentials[4],
    ])
  })
})
