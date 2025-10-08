import { createHash } from 'crypto'
import {
  AgentContext,
  DidDocument,
  DidDocumentService,
  DidsApi,
  MultiBaseEncoder,
  MultiHashEncoder,
  TypedArrayEncoder,
  VerificationMethod,
} from '@credo-ts/core'
import { canonicalize } from 'json-canonicalize'

import { getAgentConfig, getAgentContext } from '../../../../../core/tests/helpers'
import { WebvhDidResolver } from '../../../dids'
import { WebVhAnonCredsRegistry } from '../WebVhAnonCredsRegistry'

import {
  issuerId,
  mockResolvedDidDocument,
  mockRevRegDefResource,
  mockSchemaResource,
  verificationMethodId,
} from './mock-resources'

// Mock the WebvhDidResolver
const mockResolveResource = vi.fn()
jest.mock('../../../dids/WebvhDidResolver', () => {
  return {
    WebvhDidResolver: vi.fn().mockImplementation(() => {
      return { resolveResource: mockResolveResource }
    }),
  }
})

interface DidDocumentOptions {
  context?: string | string[]
  id: string
  alsoKnownAs?: string[]
  controller?: string | string[]
  verificationMethod?: VerificationMethod[]
  service?: DidDocumentService[]
  authentication?: Array<string | VerificationMethod>
  assertionMethod?: Array<string | VerificationMethod>
  keyAgreement?: Array<string | VerificationMethod>
  capabilityInvocation?: Array<string | VerificationMethod>
  capabilityDelegation?: Array<string | VerificationMethod>
}

// Mock DidsApi
const mockResolveDidDocument = vi.fn()
const mockDidsApi = {
  resolveDidDocument: mockResolveDidDocument,
}

describe('WebVhAnonCredsRegistry', () => {
  let agentContext: AgentContext
  let registry: WebVhAnonCredsRegistry

  beforeEach(() => {
    // Reset the mocks before each test
    mockResolveResource.mockReset()
    mockResolveDidDocument.mockReset()

    const agentConfig = getAgentConfig('WebVhAnonCredsRegistryTest')
    agentContext = getAgentContext({
      agentConfig,
      registerInstances: [
        [DidsApi, mockDidsApi],
        [WebvhDidResolver, { resolveResource: mockResolveResource }],
      ],
    })

    // Default mock for verifyProof to return true (will be overridden in verifyProof tests)
    jest.spyOn(WebVhAnonCredsRegistry.prototype, 'verifyProof').mockResolvedValue(true)

    registry = new WebVhAnonCredsRegistry()
  })

  describe('getSchema', () => {
    it('should correctly resolve and parse a valid schema using MockSchemaResource', async () => {
      const schemaId = mockSchemaResource.id

      const mockResolverResponse = {
        content: mockSchemaResource,
        schemaId: schemaId,
        schemaMetadata: mockSchemaResource.metadata || {},
        dereferencingMetadata: { contentType: 'application/json' },
      }

      mockResolveResource.mockResolvedValue(mockResolverResponse)

      const result = await registry.getSchema(agentContext, schemaId)

      expect(mockResolveResource).toHaveBeenCalledWith(agentContext, schemaId)
      expect(result).toEqual({
        schema: {
          attrNames: mockSchemaResource.content.attrNames,
          name: mockSchemaResource.content.name,
          version: mockSchemaResource.content.version,
          issuerId: issuerId,
        },
        schemaId,
        resolutionMetadata: mockResolverResponse.dereferencingMetadata,
        schemaMetadata: mockSchemaResource.metadata,
      })
    })

    it('should return resolutionMetadata with error if schemaId does not match supported pattern', async () => {
      const invalidSchemaId = 'invalid-schema-id'
      const result = await registry.getSchema(agentContext, invalidSchemaId)

      expect(mockResolveResource).not.toHaveBeenCalled()
      expect(result).toEqual({
        schemaId: invalidSchemaId,
        resolutionMetadata: {
          error: 'invalid',
          message: expect.stringContaining(`Invalid schema ID: ${invalidSchemaId}`),
        },
        schemaMetadata: {},
      })
    })

    it('should return resolutionMetadata with error if resolver fails to resolve', async () => {
      const schemaId = 'did:webvh:example.com:resource:schema/somehash'
      const errorMessage = 'Resource not found on server'
      // Simulate resolver returning an error structure
      mockResolveResource.mockResolvedValue({
        error: 'notFound',
        message: errorMessage,
      })

      const result = await registry.getSchema(agentContext, schemaId)

      expect(mockResolveResource).toHaveBeenCalledWith(agentContext, schemaId)
      expect(result).toEqual({
        schemaId,
        resolutionMetadata: {
          error: 'invalid',
          message: expect.stringContaining(
            `Resource ${schemaId} could not be resolved or is missing data. Error: notFound - ${errorMessage}`
          ),
        },
        schemaMetadata: {},
      })
    })

    it('should return resolutionMetadata with error if resolved data is not valid JSON', async () => {
      const schemaId = 'did:webvh:example.com:resource:schema/jsonhash'
      mockResolveResource.mockResolvedValue({
        content: { data: 'invalid json' },
        contentMetadata: {},
        dereferencingMetadata: {},
      })

      const result = await registry.getSchema(agentContext, schemaId)

      expect(mockResolveResource).toHaveBeenCalledWith(agentContext, schemaId)
      expect(result).toEqual({
        schemaId,
        resolutionMetadata: {
          error: 'invalid',
          message: expect.stringContaining('Failed to parse resource data'),
        },
        schemaMetadata: {},
      })
    })

    it('should return resolutionMetadata with error if resource is not attested', async () => {
      const schemaContent = { attrNames: ['a'], name: 'N', version: 'V' }
      const contentString = canonicalize(schemaContent)
      const digestBuffer = createHash('sha256').update(contentString).digest()
      const multibaseHash = MultiHashEncoder.encode(digestBuffer, 'sha-256')
      const schemaId = `did:webvh:example.com:resource:noattest/${multibaseHash}`

      const mockWebResource = {
        ...mockSchemaResource,
        type: 'IncorrectType',
      }
      mockResolveResource.mockResolvedValue({
        content: mockWebResource,
        contentMetadata: {},
        dereferencingMetadata: {},
      })

      const result = await registry.getSchema(agentContext, schemaId)

      expect(mockResolveResource).toHaveBeenCalledWith(agentContext, schemaId)
      expect(result).toEqual({
        schemaId,
        resolutionMetadata: {
          error: 'invalid',
          message: expect.stringContaining('Missing AttestedResource type'),
        },
        schemaMetadata: {},
      })
    })

    it('should return resolutionMetadata with error if proof validation fails (placeholder)', async () => {
      // Use a type assertion to access the private method for mocking
      const verifyProofSpy = jest.spyOn(WebVhAnonCredsRegistry.prototype, 'verifyProof')
      verifyProofSpy.mockResolvedValueOnce(false)

      const schemaContent = { attrNames: ['a'], name: 'N', version: 'V' }
      const digestBuffer = TypedArrayEncoder.fromString(canonicalize(schemaContent))
      const multibaseHash = MultiBaseEncoder.encode(MultiHashEncoder.encode(digestBuffer, 'sha-256'), 'base58btc')
      const schemaId = `did:webvh:example.com:resource:badproof/${multibaseHash}`

      const mockWebResource = {
        type: ['AttestedResource'],
        proof: {
          // Ensure a complete proof object is here, even if values are dummy
          type: 'BadProof',
          cryptosuite: 'dummy-suite',
          proofPurpose: 'assertionMethod',
          proofValue: 'dummy-value',
          verificationMethod: 'dummy-vm',
        },
        content: schemaContent,
        id: schemaId,
        '@context': ['https://w3id.org/security/data-integrity/v2'],
      }
      mockResolveResource.mockResolvedValue({
        content: mockWebResource, // Provide the full resource here
        contentMetadata: {},
        dereferencingMetadata: { contentType: 'application/json' },
      })

      const result = await registry.getSchema(agentContext, schemaId)

      expect(mockResolveResource).toHaveBeenCalledWith(agentContext, schemaId)
      // Expect the 'invalid' error due to verifyProof returning false
      expect(result).toEqual({
        schemaId,
        resolutionMetadata: {
          error: 'invalid',
          message: expect.stringContaining('Resolved resource proof is invalid'),
        },
        schemaMetadata: {},
      })
      // Restore the original method if needed elsewhere
      verifyProofSpy.mockRestore()
    })

    it('should return resolutionMetadata with error if content hash does not match schemaId', async () => {
      const schemaContent = { attrNames: ['a'], name: 'N', version: 'V' }
      const wrongMultibaseHash = 'zQmWrongHash123' // Keep this wrong hash
      const schemaId = `did:webvh:example.com:resource:wronghash/${wrongMultibaseHash}`

      const mockWebResource = {
        type: ['AttestedResource'],
        proof: {
          // Add complete proof object
          type: 'ExampleProof',
          cryptosuite: 'eddsa-jcs-2022',
          proofPurpose: 'assertionMethod',
          proofValue: 'z4RCLxRSVeTM4UnZ6vDmDjEX9pbpdUptXuDTy7h8Fij2npReHXmCUzzb5jTEUg1dFtpjH7tiKNJwXztwSktdjaMtX',
          verificationMethod: 'did:webvh:example#key-1',
        },
        content: schemaContent,
        id: schemaId, // Use the ID with the wrong hash
        '@context': ['https://w3id.org/security/data-integrity/v2'],
      }
      mockResolveResource.mockResolvedValue({
        content: mockWebResource, // Provide the full resource
        contentMetadata: {},
        dereferencingMetadata: { contentType: 'application/json' },
        // No top-level error needed as the error happens after resolution
      })

      const result = await registry.getSchema(agentContext, schemaId)

      expect(mockResolveResource).toHaveBeenCalledWith(agentContext, schemaId)
      // Expect the 'invalid' error due to hash mismatch
      expect(result).toEqual({
        schemaId,
        resolutionMetadata: {
          error: 'invalid',
          message: expect.stringContaining('Content hash mismatch'),
        },
        schemaMetadata: {},
      })
    })

    it('should return resolutionMetadata with error if parsed content is missing required fields', async () => {
      const incompleteContent = {
        issuerId: 'did:webvh:example.com:resource:incomplete',
        name: 'TestSchema',
        version: '1.0',
      }
      const contentString = canonicalize(incompleteContent)
      const contentBuffer = TypedArrayEncoder.fromString(contentString)
      const multibaseHash = MultiBaseEncoder.encode(MultiHashEncoder.encode(contentBuffer, 'sha-256'), 'base58btc')
      const schemaId = `did:webvh:example.com:resource:incomplete/${multibaseHash}`

      const mockWebResource = {
        type: ['AttestedResource'],
        proof: {
          // Add complete proof object
          type: 'ExampleProof',
          cryptosuite: 'eddsa-jcs-2022',
          proofPurpose: 'assertionMethod',
          proofValue: 'z4RCLxRSVeTM4UnZ6vDmDjEX9pbpdUptXuDTy7h8Fij2npReHXmCUzzb5jTEUg1dFtpjH7tiKNJwXztwSktdjaMtX',
          verificationMethod: 'did:webvh:example#key-1',
        },
        content: incompleteContent, // Provide the incomplete content
        id: schemaId,
        '@context': ['https://w3id.org/security/data-integrity/v2'],
      }
      mockResolveResource.mockResolvedValue({
        content: mockWebResource, // Provide the full resource
        contentMetadata: {},
        dereferencingMetadata: { contentType: 'application/json' },
        // No top-level error needed as the error happens after resolution
      })

      const result = await registry.getSchema(agentContext, schemaId)

      expect(mockResolveResource).toHaveBeenCalledWith(agentContext, schemaId)
      // Expect the 'invalid' error due to missing schema fields
      expect(result).toEqual({
        schemaId,
        resolutionMetadata: {
          error: 'invalid',
          message: expect.stringContaining('not a valid schema'), // Updated message check
        },
        schemaMetadata: {},
      })
    })
  })

  describe('getCredentialDefinition', () => {
    it('should return resolutionMetadata with error for invalid prefix (tested via helper)', async () => {
      const credDefId = 'did:web:example.com/resource/credDef123' // Invalid prefix for this registry

      // We expect the helper function to throw before specific logic is hit
      const result = await registry.getCredentialDefinition(agentContext, credDefId)

      // Expect the error thrown by the helper function
      expect(result.resolutionMetadata.error).toBe('invalid')
      expect(result.resolutionMetadata.message).toContain(`Invalid credential definition ID: ${credDefId}`)
      expect(mockResolveResource).not.toHaveBeenCalled() // Resolver shouldn't be called if prefix check fails
    })

    it('should return resolutionMetadata with error if credentialDefinitionId is invalid (tested via helper)', async () => {
      const invalidCredDefId = 'did:webvh:invalid-id' // Correct prefix, but might fail later

      // Mock the resolver to return a specific error for this ID to simulate a resolution failure
      // Or let it proceed and expect failure during validation within the helper
      // Here, we test the helper's initial ID format check
      mockResolveResource.mockResolvedValue({ error: 'notFound', message: 'Simulated resolution failure' })

      const result = await registry.getCredentialDefinition(agentContext, invalidCredDefId)

      // The helper WILL call the resolver, but the resolution fails.
      expect(mockResolveResource).toHaveBeenCalledWith(agentContext, invalidCredDefId)

      // Expect the error propagated from the helper/resolver
      expect(result.resolutionMetadata.error).toBe('invalid')
      expect(result.resolutionMetadata.message).toContain('could not be resolved or is missing data')
    })
  })

  describe('getRevocationRegistryDefinition', () => {
    it('should correctly resolve and parse a valid RevRegDef resource', async () => {
      const revRegDefId = mockRevRegDefResource.id
      const mockResolverResponse = {
        content: mockRevRegDefResource,
        contentMetadata: mockRevRegDefResource.metadata || {},
        dereferencingMetadata: { contentType: 'application/json' },
      }

      mockResolveResource.mockResolvedValue(mockResolverResponse)

      // We need to mock verifyProof to return true for this test
      const verifyProofSpy = jest.spyOn(WebVhAnonCredsRegistry.prototype, 'verifyProof')
      verifyProofSpy.mockResolvedValue(true)

      const result = await registry.getRevocationRegistryDefinition(agentContext, revRegDefId)

      expect(mockResolveResource).toHaveBeenCalledWith(agentContext, revRegDefId)
      expect(verifyProofSpy).toHaveBeenCalled()
      expect(result.resolutionMetadata.error).toBeUndefined()
      expect(result.revocationRegistryDefinition).toBeDefined()
      expect(result.revocationRegistryDefinition?.issuerId).toBe(mockRevRegDefResource.content.issuerId)
      expect(result.revocationRegistryDefinition?.revocDefType).toBe(mockRevRegDefResource.content.revocDefType)
      expect(result.revocationRegistryDefinition?.credDefId).toBe(mockRevRegDefResource.content.credDefId)
      expect(result.revocationRegistryDefinition?.tag).toBe(mockRevRegDefResource.content.tag)
      expect(result.revocationRegistryDefinition?.value).toEqual(mockRevRegDefResource.content.value)
      expect(result.revocationRegistryDefinitionMetadata).toEqual(mockRevRegDefResource.metadata)
      expect(result.resolutionMetadata).toEqual(mockResolverResponse.dereferencingMetadata)

      verifyProofSpy.mockRestore()
    })

    // Add more tests for error cases (invalid ID, not found, hash mismatch, invalid content etc.)
    // similar to the getSchema tests
  })

  describe('verifyProof', () => {
    beforeEach(() => {
      // Clear the default verifyProof mock for these tests
      jest.restoreAllMocks()

      // Mock successful DID resolution
      mockResolveDidDocument.mockResolvedValue(
        new DidDocument(mockResolvedDidDocument as unknown as DidDocumentOptions)
      )
    })

    it('should return true for valid DataIntegrityProof with eddsa-jcs-2022', async () => {
      const result = await registry.verifyProof(agentContext, mockSchemaResource)

      expect(result).toBe(true)
      expect(mockResolveDidDocument).toHaveBeenCalledWith(verificationMethodId)
    })

    it('should return false for null proof', async () => {
      const testInput = { ...mockSchemaResource }
      // @ts-ignore
      testInput.proof = null
      const result = await registry.verifyProof(agentContext, testInput)
      expect(result).toBe(false)
      expect(mockResolveDidDocument).not.toHaveBeenCalled()
    })

    it('should return false for undefined proof', async () => {
      const testInput = { ...mockSchemaResource }
      // @ts-ignore
      testInput.proof = undefined
      const result = await registry.verifyProof(agentContext, testInput)
      expect(result).toBe(false)
      expect(mockResolveDidDocument).not.toHaveBeenCalled()
    })

    it('should return false for non-object proof', async () => {
      const testInput = { ...mockSchemaResource }
      // @ts-ignore
      testInput.proof = testInput.proof.proofValue
      const result = await registry.verifyProof(agentContext, testInput)
      expect(result).toBe(false)
      expect(mockResolveDidDocument).not.toHaveBeenCalled()
    })

    it('should return false for wrong proof type', async () => {
      const testInput = { ...mockSchemaResource }
      const testProof = { ...mockSchemaResource.proof }
      // @ts-ignore
      testProof.type = 'Ed25519Signature2020'
      testInput.proof = testProof
      const result = await registry.verifyProof(agentContext, testInput)
      expect(result).toBe(false)
      expect(mockResolveDidDocument).not.toHaveBeenCalled()
    })

    it('should return false for wrong cryptosuite', async () => {
      const testInput = { ...mockSchemaResource }
      const testProof = { ...mockSchemaResource.proof }
      testProof.cryptosuite = 'eddsa-rdfc-2022'
      testInput.proof = testProof
      const result = await registry.verifyProof(agentContext, testInput)
      expect(result).toBe(false)
      expect(mockResolveDidDocument).not.toHaveBeenCalled()
    })

    it('should return false for missing verificationMethod', async () => {
      const testInput = { ...mockSchemaResource }
      const testProof = { ...mockSchemaResource.proof }
      // @ts-ignore
      testProof.verificationMethod = undefined
      testInput.proof = testProof
      const result = await registry.verifyProof(agentContext, testInput)
      expect(result).toBe(false)
      // expect(mockResolveDidDocument).not.toHaveBeenCalled()
    })

    it('should return false for invalid verificationMethod type', async () => {
      const testInput = { ...mockSchemaResource }
      const testProof = { ...mockSchemaResource.proof }
      // @ts-ignore
      testProof.verificationMethod = { id: testProof.verificationMethod }
      testInput.proof = testProof
      const result = await registry.verifyProof(agentContext, testInput)
      expect(result).toBe(false)
    })

    it('should return false for missing proofValue', async () => {
      const testInput = { ...mockSchemaResource }
      const testProof = { ...mockSchemaResource.proof }
      // @ts-ignore
      testProof.proofValue = undefined
      testInput.proof = testProof
      const result = await registry.verifyProof(agentContext, testInput)
      expect(result).toBe(false)
      expect(mockResolveDidDocument).not.toHaveBeenCalled()
    })

    it('should return false for invalid proofValue type', async () => {
      const testInput = { ...mockSchemaResource }
      const testProof = { ...mockSchemaResource.proof }
      // @ts-ignore
      testProof.proofValue = { value: testInput.proof.proofValue }
      testInput.proof = testProof
      const result = await registry.verifyProof(agentContext, testInput)
      expect(result).toBe(false)
      expect(mockResolveDidDocument).not.toHaveBeenCalled()
    })

    it('should return false when DID resolution fails', async () => {
      const testInput = { ...mockSchemaResource }

      // Mock DID resolution failure
      mockResolveDidDocument.mockResolvedValue({
        didDocument: null,
        didResolutionMetadata: { error: 'notFound' },
        didDocumentMetadata: {},
      })

      const result = await registry.verifyProof(agentContext, testInput)
      expect(result).toBe(false)
      expect(mockResolveDidDocument).toHaveBeenCalled()
    })

    it('should return false when verification method not found in DID document', async () => {
      const testInput = { ...mockSchemaResource }
      const testProof = { ...mockSchemaResource.proof }
      // @ts-ignore
      testProof.verificationMethod = `${issuerId}#key-01`
      testInput.proof = testProof
      const result = await registry.verifyProof(agentContext, testInput)
      expect(result).toBe(false)
    })

    it('should return false when signature verification fails', async () => {
      const testInput = { ...mockSchemaResource }
      const testProof = { ...mockSchemaResource.proof }
      testProof.proofValue = 'z58DAdFfa9SkqZMVPxAQpic7ndSayn1PzZs6ZjWp1CktyGesjuTSwRdoWhAfGFCF5bppETSTojQCrfFPP2oumHKtz'
      testInput.proof = testProof

      const result = await registry.verifyProof(agentContext, testInput)
      expect(result).toBe(false)
      expect(mockResolveDidDocument).toHaveBeenCalled()
    })

    it('should handle proof without optional fields', async () => {
      const testInput = { ...mockSchemaResource }
      const result = await registry.verifyProof(agentContext, testInput)

      expect(result).toBe(true)
      expect(mockResolveDidDocument).toHaveBeenCalled()
    })
  })
})
