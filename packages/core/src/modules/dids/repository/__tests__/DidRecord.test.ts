import { DidDocumentRole } from '../../domain/DidDocumentRole'
import { DidRecord } from '../DidRecord'
import { DidRecordMetadataKeys } from '../didRecordMetadataTypes'

describe('DidRecord', () => {
  describe('getTags', () => {
    it('should return default tags', () => {
      const didRecord = new DidRecord({
        did: 'did:example:123456789abcdefghi',
        role: DidDocumentRole.Created,
      })

      didRecord.metadata.set(DidRecordMetadataKeys.LegacyDid, {
        didDocumentString: '{}',
        unqualifiedDid: 'unqualifiedDid',
      })

      expect(didRecord.getTags()).toEqual({
        role: DidDocumentRole.Created,
        method: 'example',
        legacyUnqualifiedDid: 'unqualifiedDid',
        did: 'did:example:123456789abcdefghi',
        methodSpecificIdentifier: '123456789abcdefghi',
      })
    })
  })
})
