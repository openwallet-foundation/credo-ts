import '@hyperledger/indy-vdr-nodejs'
import { JsonTransformer } from '@credo-ts/core'

import { getAgentConfig, getAgentContext, mockProperty } from '../../../../core/tests/helpers'
import { IndyVdrPoolService } from '../../pool'
import { IndyVdrPool } from '../../pool/IndyVdrPool'
import { IndyVdrIndyDidResolver } from '../IndyVdrIndyDidResolver'

import type { MockedClassConstructor } from '../../../../../tests/types'
import didIndyLjgpST2rjsoxYegQDRm7EL from './__fixtures__/didIndyLjgpST2rjsoxYegQDRm7EL.json'
import didIndyLjgpST2rjsoxYegQDRm7ELdiddocContent from './__fixtures__/didIndyLjgpST2rjsoxYegQDRm7ELdiddocContent.json'
import didIndyR1xKJw17sUoXhejEpugMYJFixture from './__fixtures__/didIndyR1xKJw17sUoXhejEpugMYJ.json'
import didIndyWJz9mHyW9BZksioQnRsrAoFixture from './__fixtures__/didIndyWJz9mHyW9BZksioQnRsrAo.json'

vi.mock('../../pool/IndyVdrPool')
const IndyVdrPoolMock = IndyVdrPool as MockedClassConstructor<typeof IndyVdrPool>
const poolMock = new IndyVdrPoolMock()
mockProperty(poolMock, 'indyNamespace', 'ns1')

const agentConfig = getAgentConfig('IndyVdrIndyDidResolver')

const agentContext = getAgentContext({
  agentConfig,
  registerInstances: [[IndyVdrPoolService, { getPoolForNamespace: vi.fn().mockReturnValue(poolMock) }]],
})

const resolver = new IndyVdrIndyDidResolver()

describe('IndyVdrIndyDidResolver', () => {
  describe('NYMs with diddocContent', () => {
    it('should correctly resolve a did:indy document with arbitrary diddocContent', async () => {
      const did = 'did:indy:ns2:LjgpST2rjsoxYegQDRm7EL'

      const nymResponse = {
        result: {
          data: JSON.stringify({
            did: 'LjgpST2rjsoxYegQDRm7EL',
            verkey: 'E6D1m3eERqCueX4ZgMCY14B4NceAr6XP2HyVqt55gDhu',
            role: 'ENDORSER',
            diddocContent: JSON.stringify(didIndyLjgpST2rjsoxYegQDRm7ELdiddocContent),
          }),
        },
      }

      const poolMockSubmitRequest = vi.spyOn(poolMock, 'submitRequest')
      poolMockSubmitRequest.mockResolvedValueOnce(nymResponse)

      const result = await resolver.resolve(agentContext, did)

      expect(poolMockSubmitRequest).toHaveBeenCalledTimes(1)
      expect(JsonTransformer.toJSON(result)).toMatchObject({
        didDocument: didIndyLjgpST2rjsoxYegQDRm7EL,
        didDocumentMetadata: {},
        didResolutionMetadata: {
          contentType: 'application/did+ld+json',
        },
      })
    })
  })

  describe('NYMs without diddocContent', () => {
    it('should correctly resolve a did:indy document without endpoint attrib', async () => {
      const did = 'did:indy:ns1:R1xKJw17sUoXhejEpugMYJ'

      const nymResponse = {
        result: {
          data: JSON.stringify({
            did: 'R1xKJw17sUoXhejEpugMYJ',
            verkey: 'E6D1m3eERqCueX4ZgMCY14B4NceAr6XP2HyVqt55gDhu',
            role: 'ENDORSER',
          }),
        },
      }

      const attribResponse = {
        result: {
          data: null,
        },
      }

      vi.spyOn(poolMock, 'submitRequest').mockResolvedValueOnce(nymResponse)
      vi.spyOn(poolMock, 'submitRequest').mockResolvedValueOnce(attribResponse)

      const result = await resolver.resolve(agentContext, did)

      expect(JsonTransformer.toJSON(result)).toMatchObject({
        didDocument: didIndyR1xKJw17sUoXhejEpugMYJFixture,
        didDocumentMetadata: {},
        didResolutionMetadata: {
          contentType: 'application/did+ld+json',
        },
      })
    })

    it('should correctly resolve a did:indy document with endpoint attrib', async () => {
      const did = 'did:indy:ns1:WJz9mHyW9BZksioQnRsrAo'

      const nymResponse = {
        result: {
          data: JSON.stringify({
            did: 'WJz9mHyW9BZksioQnRsrAo',
            verkey: 'GyYtYWU1vjwd5PFJM4VSX5aUiSV3TyZMuLBJBTQvfdF8',
            role: 'ENDORSER',
          }),
        },
      }

      const attribResponse = {
        result: {
          data: JSON.stringify({
            endpoint: {
              endpoint: 'https://agent.com',
              types: ['endpoint', 'did-communication', 'DIDComm'],
              routingKeys: ['routingKey1', 'routingKey2'],
            },
          }),
        },
      }

      vi.spyOn(poolMock, 'submitRequest').mockResolvedValueOnce(nymResponse)
      vi.spyOn(poolMock, 'submitRequest').mockResolvedValueOnce(attribResponse)

      const result = await resolver.resolve(agentContext, did)

      expect(JsonTransformer.toJSON(result)).toMatchObject({
        didDocument: didIndyWJz9mHyW9BZksioQnRsrAoFixture,
        didDocumentMetadata: {},
        didResolutionMetadata: {
          contentType: 'application/did+ld+json',
        },
      })
    })

    it('should return did resolution metadata with error if the indy ledger service throws an error', async () => {
      const did = 'did:indy:ns1:R1xKJw17sUoXhejEpugMYJ'

      vi.spyOn(poolMock, 'submitRequest').mockRejectedValue(new Error('Error submitting read request'))

      const result = await resolver.resolve(agentContext, did)

      expect(result).toMatchObject({
        didDocument: null,
        didDocumentMetadata: {},
        didResolutionMetadata: {
          error: 'notFound',
          message: `resolver_error: Unable to resolve did 'did:indy:ns1:R1xKJw17sUoXhejEpugMYJ': Error: Error submitting read request`,
        },
      })
    })
  })
})
