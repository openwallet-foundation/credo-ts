import type { WebVhDidLog, WebVhDidLogEntry } from '../attestedResource'
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

describe('WebVhDidLog types', () => {
  it('WebVhDidLogEntry is assignable from a valid log entry shape', () => {
    const entry: WebVhDidLogEntry = {
      versionId: '1-zQmHash',
      versionTime: '2026-01-01T00:00:00Z',
      parameters: {
        method: 'did:webvh:0.5',
        updateKeys: ['zKey1'],
      },
      state: {
        id: 'did:webvh:example.com:01',
        '@context': ['https://www.w3.org/ns/did/v1'],
      },
    }

    expect(entry.versionId).toBe('1-zQmHash')
    expect(entry.parameters.updateKeys).toEqual(['zKey1'])
  })

  it('WebVhDidLog is assignable from an array of log entries', () => {
    const log: WebVhDidLog = [
      {
        versionId: '1-zQmHash',
        versionTime: '2026-01-01T00:00:00Z',
        parameters: { method: 'did:webvh:0.5' },
        state: { id: 'did:webvh:example.com:01', '@context': ['https://www.w3.org/ns/did/v1'] },
      },
    ]

    expect(log).toHaveLength(1)
    expect(log[0].versionId).toBe('1-zQmHash')
  })
})
