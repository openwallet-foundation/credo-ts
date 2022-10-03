import { DidDocumentRole } from '../../domain/DidDocumentRole'
import { DidRecord } from '../DidRecord'
import { DidRecordMetadataKeys } from '../didRecordMetadataTypes'

import { DidType } from '@aries-framework/core'

describe('DidRecord', () => {
  describe('getTags', () => {
    it('should return default tags', () => {
      const didRecord = new DidRecord({
        didType: DidType.Unknown,
        id: 'did:example:123456789abcdefghi',
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
      })
    })
  })
})
