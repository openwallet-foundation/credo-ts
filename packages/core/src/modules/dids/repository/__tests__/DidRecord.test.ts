import { PublicJwk } from '../../../kms'
import { DidCommV1Service, DidDocumentBuilder, getEd25519VerificationKey2018 } from '../../domain'
import { DidDocumentRole } from '../../domain/DidDocumentRole'
import { DidRecord } from '../DidRecord'
import { DidRecordMetadataKeys } from '../didRecordMetadataTypes'

describe('DidRecord', () => {
  describe('getTags', () => {
    it('stores the fingerprints of recipient keys from the did document when a did document is present', () => {
      const publicJwk = PublicJwk.fromFingerprint('z6MkqRYqQiSgvZQdnBytw86Qbs2ZWUkGv22od935YF4s8M7V')
      const verificationMethod = getEd25519VerificationKey2018({
        publicJwk,
        controller: 'did:example:alice#id',
        id: '#key-1',
      })
      const didDocument = new DidDocumentBuilder('did:example:alice')
        .addVerificationMethod(verificationMethod)
        .addAuthentication(verificationMethod.id)
        .addService(
          new DidCommV1Service({
            id: '#service-0',
            recipientKeys: [verificationMethod.id],
            serviceEndpoint: 'https://example.com',
            accept: ['didcomm/aip2;env=rfc19'],
          })
        )
        .build()

      const didRecord = new DidRecord({
        did: 'did:example:alice',
        role: DidDocumentRole.Received,
        didDocument,
      })

      expect(didRecord.getTags().recipientKeyFingerprints).toEqual([publicJwk.fingerprint])
    })

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
