import type { AgentContext } from '@credo-ts/core'
import { Agent } from '@credo-ts/core'
import type { Jwk } from '@openid4vc/oauth2'
import { InMemoryWalletModule } from '../../../../../tests/InMemoryWalletModule'
import { agentDependencies } from '../../../../node/src'
import { OpenId4VcModule } from '../../OpenId4VcModule'
import { getLocalAccessTokenJwks, getOid4vcLocalJwksCallback } from '../localJwks'

const accessTokenPublicJwk = {
  kty: 'EC',
  crv: 'P-256',
  x: 'rQbiDHRutR4YcJaWRV54Dx-sx81VlK7xuohm4-RXRT0',
  y: 'YM4MRy90G9PW59wKcawyrHDCPp7QsE6l5QT-H2Koz_M',
} satisfies Jwk

const localJwksUri = 'https://issuer.com/oid4vci/issuer-id/jwks'

const agent = new Agent({
  config: {},
  dependencies: agentDependencies,
  modules: {
    openid4vc: new OpenId4VcModule(),
    inMemory: new InMemoryWalletModule(),
  },
})

describe('getOid4vcLocalJwksCallback', () => {
  let agentContext: AgentContext

  beforeAll(async () => {
    await agent.initialize()
    agentContext = agent.context
  })

  afterAll(async () => {
    await agent.shutdown()
  })

  test('resolves a local jwks for the jwks uri it is published on', async () => {
    const { getJwks } = getOid4vcLocalJwksCallback(
      agentContext,
      getLocalAccessTokenJwks(localJwksUri, accessTokenPublicJwk)
    )

    expect(await getJwks?.(localJwksUri)).toEqual({ keys: [accessTokenPublicJwk] })
  })

  test('returns undefined for a jwks uri that is not local, so it is fetched as usual', async () => {
    const { getJwks } = getOid4vcLocalJwksCallback(
      agentContext,
      getLocalAccessTokenJwks(localJwksUri, accessTokenPublicJwk)
    )

    expect(await getJwks?.('https://external-authorization-server.com/jwks')).toBeUndefined()
  })

  test('returns undefined for every jwks uri if there are no local jwks', async () => {
    const { getJwks } = getOid4vcLocalJwksCallback(agentContext, {})

    expect(await getJwks?.(localJwksUri)).toBeUndefined()
  })
})
