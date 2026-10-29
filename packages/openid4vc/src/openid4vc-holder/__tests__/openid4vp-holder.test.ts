import { AgentConfig } from '@credo-ts/core'
import { getAgentContext } from '../../../../core/tests'
import { agentDependencies } from '../../../../node/src'
import { OpenId4VpHolderService } from '../OpenId4vpHolderService'

describe('OpenId4VpHolderService', () => {
  const fetch = vi.fn()
  const agentContext = getAgentContext({ agentConfig: new AgentConfig({}, { ...agentDependencies, fetch }) })
  const holderService = new OpenId4VpHolderService({} as never, {} as never)

  const request = {
    response_type: 'vp_token',
    response_mode: 'direct_post',
    response_uri: 'https://verifier.example.com/response',
    nonce: 'n-0S6_WzA2Mj',
    dcql_query: { credentials: [{ id: 'pid', format: 'dc+sd-jwt', meta: { vct_values: ['urn:pid'] } }] },
  }

  test.each([
    ['client_id', { ...request, client_id: 'didcomm:did:example:verifier' }],
    [
      'pre-registered client_id_scheme',
      { ...request, client_id: 'didcomm:did:example:verifier', client_id_scheme: 'pre-registered' },
    ],
    [
      'request_uri',
      { client_id: 'didcomm:did:example:verifier', request_uri: 'https://verifier.example.com/request.jwt' },
    ],
  ])('rejects a didcomm: client id in %s before fetching anything', async (_, authorizationRequest) => {
    await expect(holderService.resolveAuthorizationRequest(agentContext, authorizationRequest)).rejects.toThrow(
      "Client id 'didcomm:did:example:verifier' is a DIDComm audience and is not allowed in OpenID4VP"
    )
    expect(fetch).not.toHaveBeenCalled()
  })
})
