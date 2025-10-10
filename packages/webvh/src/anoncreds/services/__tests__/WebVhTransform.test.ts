import { JsonTransformer } from '@credo-ts/core'

import { WebVhResource } from '../../utils/transform'

import { mockCredDefResource, mockSchemaResource } from './mock-resources'

describe('WebVhTransform', () => {
  it('should correctly transform a schema resource', () => {
    const resource = JsonTransformer.fromJSON(mockSchemaResource, WebVhResource)

    expect(resource).toBeInstanceOf(WebVhResource)
    expect(resource['@context']).toContain('https://opsecid.github.io/attested-resource/v1')
    expect(resource.type).toEqual(['AttestedResource'])

    // Type guard to check if content is a schema
    if ('attrNames' in resource.content) {
      expect(resource.content.name).toBe(mockSchemaResource.content.name)
      expect(resource.content.version).toBe(mockSchemaResource.content.version)
      expect(Array.isArray(resource.content.attrNames)).toBe(true)
      expect(resource.content.attrNames).toContain(mockSchemaResource.content.attrNames[0])
    } else {
      throw new Error('Content should be a schema')
    }
  })

  it('should correctly transform a credential definition resource', () => {
    const resource = JsonTransformer.fromJSON(mockCredDefResource, WebVhResource)

    expect(resource).toBeInstanceOf(WebVhResource)
    expect(resource['@context']).toContain('https://opsecid.github.io/attested-resource/v1')
    expect(resource.type).toEqual(['AttestedResource'])

    // Type guard to check if content is a credential definition
    if ('schemaId' in resource.content) {
      expect(resource.content.type).toBe(mockCredDefResource.content.type)
      expect(resource.content.tag).toBe(mockCredDefResource.content.tag)
      expect(resource.content.schemaId).toBe(mockSchemaResource.id)
    } else {
      throw new Error('Content should be a credential definition')
    }
  })
})
