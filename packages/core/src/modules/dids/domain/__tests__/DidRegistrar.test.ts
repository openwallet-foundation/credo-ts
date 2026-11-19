import { getRemovedDidKeys } from '../DidRegistrar'

describe('getRemovedDidKeys', () => {
  it('returns the previous keys that no remaining key uses', () => {
    const previousKeys = [
      { didDocumentRelativeKeyId: '#kept', kmsKeyId: 'kept' },
      { didDocumentRelativeKeyId: '#removed', kmsKeyId: 'removed', kmsBackend: 'askar' },
      { didDocumentRelativeKeyId: '#removed-shared', kmsKeyId: 'shared' },
    ]
    // A remaining verification method uses the same key as a removed one
    const remainingKeys = [
      { didDocumentRelativeKeyId: '#kept', kmsKeyId: 'kept' },
      { didDocumentRelativeKeyId: '#shared', kmsKeyId: 'shared' },
    ]

    expect(getRemovedDidKeys(previousKeys, remainingKeys)).toEqual([{ keyId: 'removed', kmsBackend: 'askar' }])
    expect(getRemovedDidKeys(previousKeys, undefined)).toHaveLength(3)
  })
})
