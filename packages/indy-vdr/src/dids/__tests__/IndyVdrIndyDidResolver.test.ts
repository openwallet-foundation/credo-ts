import { JsonTransformer } from '@aries-framework/core'
import { parseDid } from '@aries-framework/core/src/modules/dids/domain/parse'
import { getAgentConfig, getAgentContext, mockProperty } from '@aries-framework/core/tests/helpers'

import { IndyVdrPool, IndyVdrPoolService } from '../../pool'
import { IndyVdrSovDidResolver } from '../IndyVdrSovDidResolver'

import didSovR1xKJw17sUoXhejEpugMYJFixture from './__fixtures__/didSovR1xKJw17sUoXhejEpugMYJ.json'
import didSovWJz9mHyW9BZksioQnRsrAoFixture from './__fixtures__/didSovWJz9mHyW9BZksioQnRsrAo.json'

jest.mock('../../pool/IndyVdrPoolService')
const IndyVdrPoolServiceMock = IndyVdrPoolService as jest.Mock<IndyVdrPoolService>
const poolServiceMock = new IndyVdrPoolServiceMock()

jest.mock('../../pool/IndyVdrPool')
const IndyVdrPoolMock = IndyVdrPool as jest.Mock<IndyVdrPool>
const poolMock = new IndyVdrPoolMock()
mockProperty(poolMock, 'indyNamespace', 'local')
jest.spyOn(poolServiceMock, 'getPoolForDid').mockResolvedValue(poolMock)

const agentConfig = getAgentConfig('IndyVdrIndyDidResolver')

const agentContext = getAgentContext({
  agentConfig,
  registerInstances: [[IndyVdrPoolService, poolServiceMock]],
})

const resolver = new IndyVdrSovDidResolver()

describe('IndyVdrIndyDidResolver', () => {
  describe('NYMs without diddocContent', () => {
    it('should correctly resolve a did:indy document', async () => {
      const did = 'did:indy:indyNamespace:R1xKJw17sUoXhejEpugMYJ'

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
          data: JSON.stringify({
            endpoint: {
              endpoint: 'https://ssi.com',
              profile: 'https://profile.com',
              hub: 'https://hub.com',
            },
          }),
        },
      }

      jest.spyOn(poolMock, 'submitReadRequest').mockResolvedValueOnce(nymResponse)
      jest.spyOn(poolMock, 'submitReadRequest').mockResolvedValueOnce(attribResponse)

      const result = await resolver.resolve(agentContext, did, parseDid(did))

      expect(JsonTransformer.toJSON(result)).toMatchObject({
        didDocument: didSovR1xKJw17sUoXhejEpugMYJFixture,
        didDocumentMetadata: {},
        didResolutionMetadata: {
          contentType: 'application/did+ld+json',
        },
      })
    })

    it('should resolve a did:indy document with routingKeys and types entries in the attrib', async () => {
      const did = 'did:indy:indyNamespace:WJz9mHyW9BZksioQnRsrAo'

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

      jest.spyOn(poolMock, 'submitReadRequest').mockResolvedValueOnce(nymResponse)
      jest.spyOn(poolMock, 'submitReadRequest').mockResolvedValueOnce(attribResponse)

      const result = await resolver.resolve(agentContext, did, parseDid(did))

      expect(JsonTransformer.toJSON(result)).toMatchObject({
        didDocument: didSovWJz9mHyW9BZksioQnRsrAoFixture,
        didDocumentMetadata: {},
        didResolutionMetadata: {
          contentType: 'application/did+ld+json',
        },
      })
    })

    it('should return did resolution metadata with error if the indy ledger service throws an error', async () => {
      const did = 'did:indy:indyNamespace:R1xKJw17sUoXhejEpugMYJ'

      jest.spyOn(poolMock, 'submitReadRequest').mockRejectedValue(new Error('Error submitting read request'))

      const result = await resolver.resolve(agentContext, did, parseDid(did))

      expect(result).toMatchObject({
        didDocument: null,
        didDocumentMetadata: {},
        didResolutionMetadata: {
          error: 'notFound',
          message: `resolver_error: Unable to resolve did 'did:indy:R1xKJw17sUoXhejEpugMYJ': Error: Error submitting read request`,
        },
      })
    })
  })
})
