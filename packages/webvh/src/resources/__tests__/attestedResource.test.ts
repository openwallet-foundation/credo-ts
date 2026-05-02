import { getResourceType, isWebVhAttestedResource, parseResourceId } from '../attestedResource'

describe('attestedResource helpers', () => {
  it('parses a did:webvh resource id', () => {
    const parsed = parseResourceId('did:webvh:example.com:tenant:01/resources/zQmHash')

    expect(parsed).toEqual({
      did: 'did:webvh:example.com:tenant:01',
      resourceId: 'zQmHash',
    })
  })

  it('returns null for non-resource ids', () => {
    expect(parseResourceId('did:webvh:example.com:tenant:01')).toBeNull()
  })

  it('detects valid attested resource payloads', () => {
    const valid = {
      '@context': ['https://identity.foundation/did-attested-resources/context/v0.1'],
      id: 'did:webvh:example.com:tenant:01/resources/zQmHash',
      type: ['AttestedResource'],
      content: { name: 'resource' },
      proof: {
        type: 'DataIntegrityProof',
        cryptosuite: 'eddsa-jcs-2022',
        proofPurpose: 'assertionMethod',
        proofValue: 'zProof',
        verificationMethod: 'did:webvh:example.com:tenant:01#key-1',
      },
      metadata: {
        resourceType: 'anonCredsSchema',
      },
    }

    expect(isWebVhAttestedResource(valid)).toBe(true)
    expect(getResourceType(valid)).toBe('anonCredsSchema')
  })

  it('rejects missing attested resource type', () => {
    const invalid = {
      id: 'did:webvh:example.com:tenant:01/resources/zQmHash',
      type: ['OtherType'],
      content: { name: 'resource' },
      proof: {
        type: 'DataIntegrityProof',
        cryptosuite: 'eddsa-jcs-2022',
        proofPurpose: 'assertionMethod',
        proofValue: 'zProof',
        verificationMethod: 'did:webvh:example.com:tenant:01#key-1',
      },
    }

    expect(isWebVhAttestedResource(invalid)).toBe(false)
    expect(getResourceType(invalid as never)).toBeUndefined()
  })
})
