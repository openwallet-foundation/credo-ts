import type { IndySdkPool } from '../../ledger'
import type { IndyEndpointAttrib } from '../didSovUtil'
import type { GetNymResponse } from 'indy-sdk'

import { SigningProviderRegistry, JsonTransformer } from '@aries-framework/core'
import indySdk from 'indy-sdk'

import { parseDid } from '../../../../core/src/modules/dids/domain/parse'
import { mockFunction, getAgentConfig, getAgentContext } from '../../../../core/tests/helpers'
import { IndySdkPoolService } from '../../ledger/IndySdkPoolService'
import { IndySdkSymbol } from '../../types'
import { IndySdkWallet } from '../../wallet'
import { IndySdkSovDidResolver } from '../IndySdkSovDidResolver'

import didSovR1xKJw17sUoXhejEpugMYJFixture from './__fixtures__/didSovR1xKJw17sUoXhejEpugMYJ.json'
import didSovWJz9mHyW9BZksioQnRsrAoFixture from './__fixtures__/didSovWJz9mHyW9BZksioQnRsrAo.json'

jest.mock('../../ledger/IndySdkPoolService')
const IndySdkPoolServiceMock = IndySdkPoolService as jest.Mock<IndySdkPoolService>
const indySdkPoolServiceMock = new IndySdkPoolServiceMock()

mockFunction(indySdkPoolServiceMock.getPoolForNamespace).mockReturnValue({
  config: { indyNamespace: 'pool1' },
} as IndySdkPool)

mockFunction(indySdkPoolServiceMock.getPoolForDid).mockResolvedValue({
  pool: { config: { indyNamespace: 'pool1' } } as IndySdkPool,
})

const agentConfig = getAgentConfig('IndySdkSovDidResolver')

const wallet = new IndySdkWallet(indySdk, agentConfig.logger, new SigningProviderRegistry([]))

const agentContext = getAgentContext({
  wallet,
  agentConfig,
  registerInstances: [
    [IndySdkPoolService, indySdkPoolServiceMock],
    [IndySdkSymbol, indySdk],
  ],
})

const indySdkSovDidResolver = new IndySdkSovDidResolver()

describe('IndySdkSovDidResolver', () => {
  it('should correctly resolve a did:sov document', async () => {
    const did = 'did:sov:R1xKJw17sUoXhejEpugMYJ'

    const nymResponse: GetNymResponse = {
      did: 'R1xKJw17sUoXhejEpugMYJ',
      verkey: 'E6D1m3eERqCueX4ZgMCY14B4NceAr6XP2HyVqt55gDhu',
      role: 'ENDORSER',
    }

    const endpoints: IndyEndpointAttrib = {
      endpoint: 'https://ssi.com',
      profile: 'https://profile.com',
      hub: 'https://hub.com',
    }

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    jest.spyOn(indySdkSovDidResolver, 'getPublicDid').mockResolvedValue(nymResponse)

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    jest.spyOn(indySdkSovDidResolver, 'getEndpointsForDid').mockResolvedValue(endpoints)

    const result = await indySdkSovDidResolver.resolve(agentContext, did, parseDid(did))

    expect(JsonTransformer.toJSON(result)).toMatchObject({
      didDocument: didSovR1xKJw17sUoXhejEpugMYJFixture,
      didDocumentMetadata: {},
      didResolutionMetadata: {
        contentType: 'application/did+ld+json',
      },
    })
  })

  it('should resolve a did:sov document with routingKeys and types entries in the attrib', async () => {
    const did = 'did:sov:WJz9mHyW9BZksioQnRsrAo'

    const nymResponse: GetNymResponse = {
      did: 'WJz9mHyW9BZksioQnRsrAo',
      verkey: 'GyYtYWU1vjwd5PFJM4VSX5aUiSV3TyZMuLBJBTQvfdF8',
      role: 'ENDORSER',
    }

    const endpoints: IndyEndpointAttrib = {
      endpoint: 'https://agent.com',
      types: ['endpoint', 'did-communication', 'DIDComm'],
      routingKeys: ['routingKey1', 'routingKey2'],
    }

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    jest.spyOn(indySdkSovDidResolver, 'getPublicDid').mockResolvedValue(nymResponse)

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    jest.spyOn(indySdkSovDidResolver, 'getEndpointsForDid').mockResolvedValue(endpoints)

    const result = await indySdkSovDidResolver.resolve(agentContext, did, parseDid(did))

    expect(JsonTransformer.toJSON(result)).toMatchObject({
      didDocument: didSovWJz9mHyW9BZksioQnRsrAoFixture,
      didDocumentMetadata: {},
      didResolutionMetadata: {
        contentType: 'application/did+ld+json',
      },
    })
  })

  it('should return did resolution metadata with error if the indy ledger service throws an error', async () => {
    const did = 'did:sov:R1xKJw17sUoXhejEpugMYJ'

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    jest.spyOn(indySdkSovDidResolver, 'getPublicDid').mockRejectedValue(new Error('Error retrieving did'))

    const result = await indySdkSovDidResolver.resolve(agentContext, did, parseDid(did))

    expect(result).toMatchObject({
      didDocument: null,
      didDocumentMetadata: {},
      didResolutionMetadata: {
        error: 'notFound',
        message: `resolver_error: Unable to resolve did 'did:sov:R1xKJw17sUoXhejEpugMYJ': Error: Error retrieving did`,
      },
    })
  })
})
