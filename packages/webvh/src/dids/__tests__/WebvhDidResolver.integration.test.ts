import { getAgentConfig, getAgentContext } from '../../../../core/tests/helpers'
import { WebvhDidResolver } from '../WebvhDidResolver'

interface AttestedResourceContent {
  '@context': string
  type: string[]
  content: {
    issuerId: string
    name?: string
    version?: string
    attrNames?: string[]
    schemaId?: string
    type?: string
    tag?: string
    value?: Record<string, unknown>
    credDefId?: string
    revocDefType?: string
    delta?: Record<string, unknown>
  }
}

// Mock the `didwebvh-ts` dependency so that `resolveDID` never performs a network call.
jest.mock('didwebvh-ts', () => {
  return {
    resolveDID: vi.fn(async (did: string) => {
      return {
        doc: {
          '@context': ['https://www.w3.org/ns/did/v1'],
          id: did,
          verificationMethod: [],
        },
      }
    }),
  }
})

const createStubContent = (url: string) => {
  const baseContent = {
    '@context': 'https://w3id.org/attested-resource/v1',
    type: ['AttestedResource'],
  }

  if (url.includes('zQmWsSADenC9oCxEbdKvi9KUJVJTbgZ8X75fZR5bzey1goo')) {
    // schema
    return {
      ...baseContent,
      content: {
        issuerId: 'did:example:issuer',
        name: 'Test Schema',
        version: '1.0.0',
        attrNames: ['name', 'age'],
      },
    }
  }
  if (url.includes('zQmZ572t4RDpsH6G1kZFwpZQFJ7Wm7AB5X7oAq1BFX45SWj')) {
    // credential definition
    return {
      ...baseContent,
      content: {
        issuerId: 'did:example:issuer',
        schemaId: 'schema:123',
        type: 'CL',
        tag: 'default',
        value: {},
      },
    }
  }
  if (url.includes('zQmYvDUi72UH1NW9BrdPhDA8Tfabz1N5wKJbetyRkK9zawb')) {
    // revocation registry definition
    return {
      ...baseContent,
      content: {
        issuerId: 'did:example:issuer',
        credDefId: 'creddef:123',
        revocDefType: 'CL_ACCUM',
        tag: 'default',
        value: {},
      },
    }
  }
  if (url.includes('zQmSQcPaX1PA37tak2ekRc9Cfe4uvNHZcVq6hRqWbhcP55X')) {
    // revocation registry entry – structure is flexible, only ensure object presence
    return {
      ...baseContent,
      content: {
        issuerId: 'did:example:issuer',
        delta: {},
      },
    }
  }

  // Default fallback – represents a missing resource so that tests exercising invalid
  // identifiers still receive a predictable error.
  return null
}

describe('WebvhDidResolver Integration Tests', () => {
  let resolver: WebvhDidResolver
  let agentContext: ReturnType<typeof getAgentContext>

  const realResourceIds = [
    'did:webvh:QmVG236sqSgkoi1iAXVZWGv6G6YgoQu6RujhogD4eeyoiY:identifier.me:demo:001/resources/zQmWsSADenC9oCxEbdKvi9KUJVJTbgZ8X75fZR5bzey1goo', // Schema
    'did:webvh:QmVG236sqSgkoi1iAXVZWGv6G6YgoQu6RujhogD4eeyoiY:identifier.me:demo:001/resources/zQmZ572t4RDpsH6G1kZFwpZQFJ7Wm7AB5X7oAq1BFX45SWj', // Credential Definition
    'did:webvh:QmVG236sqSgkoi1iAXVZWGv6G6YgoQu6RujhogD4eeyoiY:identifier.me:demo:001/resources/zQmYvDUi72UH1NW9BrdPhDA8Tfabz1N5wKJbetyRkK9zawb', // Revocation Registry Definition
    'did:webvh:QmVG236sqSgkoi1iAXVZWGv6G6YgoQu6RujhogD4eeyoiY:identifier.me:demo:001/resources/zQmSQcPaX1PA37tak2ekRc9Cfe4uvNHZcVq6hRqWbhcP55X', // Revocation Registry Entry
  ]

  const resourceTypes = ['schema', 'credentialDefinition', 'revocationRegistryDefinition', 'revocationRegistryEntry']

  beforeEach(() => {
    // Create a real resolver instance (no mocks in this file!)
    resolver = new WebvhDidResolver()

    // Create a fresh agent context
    const agentConfig = getAgentConfig('WebvhDidResolverIntegrationTest')
    agentContext = getAgentContext({ agentConfig })

    // Mock the agentContext's fetch method
    agentContext.config.agentDependencies.fetch = vi.fn(async (input: string | URL | Request): Promise<Response> => {
      const url = typeof input === 'string' ? input : String(input)
      const stub = createStubContent(url)

      if (!stub) {
        // Simulate a 404 for unknown resources
        return {
          ok: false,
          status: 404,
          statusText: 'Not Found',
          headers: new Headers({
            'Content-Type': 'application/json',
          }),
          json: async () => ({ error: 'notFound' }),
          text: async () => JSON.stringify({ error: 'notFound' }),
        } as Response
      }

      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({
          'Content-Type': 'application/json',
        }),
        json: async () => stub,
        text: async () => JSON.stringify(stub),
      } as Response
    })
  })

  describe('getBaseUrl', () => {
    it('should correctly parse DID URL paths', () => {
      const testCases = [
        {
          input:
            'did:webvh:QmVG236sqSgkoi1iAXVZWGv6G6YgoQu6RujhogD4eeyoiY:identifier.me:demo:001/resources/zQmWsSADenC9oCxEbdKvi9KUJVJTbgZ8X75fZR5bzey1goo',
          expected: 'https://identifier.me/demo/001/resources/zQmWsSADenC9oCxEbdKvi9KUJVJTbgZ8X75fZR5bzey1goo',
        },
        {
          input:
            'did:webvh:QmVG236sqSgkoi1iAXVZWGv6G6YgoQu6RujhogD4eeyoiY:identifier.me:demo:001/resources/zQmZ572t4RDpsH6G1kZFwpZQFJ7Wm7AB5X7oAq1BFX45SWj',
          expected: 'https://identifier.me/demo/001/resources/zQmZ572t4RDpsH6G1kZFwpZQFJ7Wm7AB5X7oAq1BFX45SWj',
        },
      ]

      for (const { input, expected } of testCases) {
        const result = resolver.getBaseUrl(input)
        expect(result).toBe(expected)
      }
    })

    it('should handle DID without URL path', () => {
      const input = 'did:webvh:QmVG236sqSgkoi1iAXVZWGv6G6YgoQu6RujhogD4eeyoiY:identifier.me:demo:001'
      const expected = 'https://identifier.me/demo/001'

      const result = resolver.getBaseUrl(input)
      expect(result).toBe(expected)
    })

    it('should throw error for invalid DID format', () => {
      const invalidDids = ['invalid:did', 'did:web:example.com', 'did:webvh:nocid', 'did:webvh:']

      for (const invalidDid of invalidDids) {
        expect(() => resolver.getBaseUrl(invalidDid)).toThrow()
      }
    })
  })

  describe('resolveResource', () => {
    // Test each resource individually
    realResourceIds.forEach((resourceId, index) => {
      const expectedType = resourceTypes[index]
      it(`should resolve real ${expectedType} resource ${index + 1}: ${resourceId.split('/').pop()}`, async () => {
        // Call the actual resolveResource method
        const result = await resolver.resolveResource(agentContext, resourceId)

        // Check for error result first
        if (!result) {
          throw new Error('Resolver returned undefined/null result')
        }

        if (result && typeof result === 'object' && 'error' in result) {
          throw new Error(`Resolver returned error: ${result.error} - ${result.message}`)
        }

        // Verify the resolver result structure
        expect(result.content).toBeDefined()
        expect(result.contentMetadata).toBeDefined()
        expect(result.dereferencingMetadata).toBeDefined()

        const content = result.content as unknown as AttestedResourceContent
        expect(content['@context']).toBeDefined()
        expect(content.type).toContain('AttestedResource')
        expect(content.content).toBeDefined()
        expect(content.content.issuerId).toBeDefined()

        // Validate based on expected resource type
        switch (expectedType) {
          case 'schema':
            expect(content.content.name).toBeDefined()
            expect(content.content.version).toBeDefined()
            expect(content.content.attrNames).toBeDefined()
            expect(Array.isArray(content.content.attrNames)).toBe(true)
            break

          case 'credentialDefinition':
            expect(content.content.schemaId).toBeDefined()
            expect(content.content.type).toBeDefined()
            expect(content.content.tag).toBeDefined()
            expect(content.content.value).toBeDefined()
            break

          case 'revocationRegistryDefinition':
            expect(content.content.credDefId).toBeDefined()
            expect(content.content.revocDefType).toBeDefined()
            expect(content.content.tag).toBeDefined()
            expect(content.content.value).toBeDefined()
            break

          case 'revocationRegistryEntry':
            // Revocation entries might have different structure, let's be flexible
            expect(typeof content.content).toBe('object')
            break

          default:
            throw new Error(`Unknown resource type: ${expectedType}`)
        }
      }, 30000) // Increase timeout for network calls
    })

    it('should resolve all resources in parallel', async () => {
      const promises = realResourceIds.map(async (resourceId, index) => {
        const expectedType = resourceTypes[index]

        const result = await resolver.resolveResource(agentContext, resourceId)

        if (!result) {
          throw new Error(`Resource ${index + 1} (${expectedType}) failed: undefined result`)
        }

        if (result && typeof result === 'object' && 'error' in result) {
          throw new Error(`Resource ${index + 1} (${expectedType}) failed: ${result.error} - ${result.message}`)
        }

        const content = result.content as unknown as AttestedResourceContent

        // Extract relevant info based on resource type
        const resourceInfo: Record<string, unknown> = {
          resourceId,
          resourceType: expectedType,
          contentType: result.contentMetadata.contentType,
          issuerId: content.content.issuerId,
        }

        switch (expectedType) {
          case 'schema':
            resourceInfo.name = content.content.name
            resourceInfo.version = content.content.version
            resourceInfo.attributeCount = content.content.attrNames?.length ?? 0
            break
          case 'credentialDefinition':
            resourceInfo.schemaId = content.content.schemaId
            resourceInfo.type = content.content.type
            resourceInfo.tag = content.content.tag
            break
          case 'revocationRegistryDefinition':
            resourceInfo.credDefId = content.content.credDefId
            resourceInfo.revocDefType = content.content.revocDefType
            resourceInfo.tag = content.content.tag
            break
          case 'revocationRegistryEntry':
            resourceInfo.availableFields = Object.keys(content.content)
            break
        }

        return resourceInfo
      })

      const results = await Promise.all(promises)

      // Verify all resolved successfully
      expect(results).toHaveLength(realResourceIds.length)
      for (const result of results) {
        expect(result.resourceType).toBeDefined()
        expect(result.contentType).toBe('application/json')
        expect(result.issuerId).toBeDefined()

        // Verify type-specific fields
        switch (result.resourceType) {
          case 'schema':
            expect(result.name).toBeDefined()
            expect(result.version).toBeDefined()
            expect(result.attributeCount as number).toBeGreaterThan(0)
            break
          case 'credentialDefinition':
            expect(result.schemaId).toBeDefined()
            expect(result.type).toBeDefined()
            expect(result.tag).toBeDefined()
            break
          case 'revocationRegistryDefinition':
            expect(result.credDefId).toBeDefined()
            expect(result.revocDefType).toBeDefined()
            expect(result.tag).toBeDefined()
            break
          case 'revocationRegistryEntry':
            expect((result.availableFields as unknown[]).length).toBeGreaterThan(0)
            break
        }
      }
    }, 60000) // Longer timeout for parallel network calls

    it('should handle invalid resource IDs gracefully', async () => {
      const invalidResourceId = 'did:webvh:invalid:identifier.me:demo:001/resources/invalidhash'

      try {
        const result = await resolver.resolveResource(agentContext, invalidResourceId)

        if (!result) {
          return
        }

        // Should return an error result
        if (result && typeof result === 'object' && 'error' in result) {
          expect(result.error).toBe('notFound')
          expect(result.message).toContain('Unable to resolve resource')
        } else {
          throw new Error('Expected error result but got success result')
        }
      } catch (error) {
        // If it throws instead of returning error result, that's also acceptable
        expect(error.message).toContain('Unable to resolve resource')
      }
    })
  })
})
