import { JsonTransformer } from '@credo-ts/core'

import { WebVhResource } from '../../utils/transform'

import { mockCredDefResource, mockSchemaResource } from './mock-resources'

describe('WebVhTransform', () => {
  it('should correctly transform a schema resource', () => {
    const resource = JsonTransformer.fromJSON(mockSchemaResource, WebVhResource)

    expect(resource).toBeInstanceOf(WebVhResource)
    expect(resource['@context']).toEqual(['https://w3id.org/security/data-integrity/v2'])
    expect(resource.type).toEqual(['AttestedResource'])

    // Type guard to check if content is a schema
    if ('attrNames' in resource.content) {
      expect(resource.content.name).toBe('Meeting Invitation')
      expect(resource.content.version).toBe('1.1')
      expect(Array.isArray(resource.content.attrNames)).toBe(true)
      expect(resource.content.attrNames).toContain('email')
    } else {
      fail('Content should be a schema')
    }
  })

  it('should correctly transform a credential definition resource', () => {
    const resource = JsonTransformer.fromJSON(mockCredDefResource, WebVhResource)

    expect(resource).toBeInstanceOf(WebVhResource)
    expect(resource['@context']).toEqual(['https://w3id.org/security/data-integrity/v2'])
    expect(resource.type).toEqual(['AttestedResource'])

    // Type guard to check if content is a credential definition
    if ('schemaId' in resource.content) {
      expect(resource.content.type).toBe('CL')
      expect(resource.content.tag).toBe('Meeting Invitation')
      expect(resource.content.schemaId).toContain('zQmc3ZT6N3s3UhqTcC5kWcWVoHwnkK6dZVBVfkLtYKY8YJm')
    } else {
      fail('Content should be a credential definition')
    }
  })
})
