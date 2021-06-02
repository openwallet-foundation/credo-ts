import { DidCommService, DidDoc } from '../../modules/connections'
import { AgentConfig } from '../AgentConfig'
import { getBaseConfig, getMockConnection } from '../../__tests__/helpers'

describe('AgentConfig', () => {
  describe('getEndpoint', () => {
    it('should return the service endpoint of the inbound connection available', () => {
      const agentConfig = new AgentConfig(getBaseConfig('AgentConfig Test'))

      const endpoint = 'https://mediator-url.com'
      agentConfig.establishInbound({
        verkey: 'test',
        connection: getMockConnection({
          theirDidDoc: new DidDoc({
            id: 'test',
            publicKey: [],
            authentication: [],
            service: [
              new DidCommService({
                id: `test;indy`,
                serviceEndpoint: endpoint,
                recipientKeys: [],
              }),
            ],
          }),
        }),
      })

      expect(agentConfig.getEndpoint()).toBe(endpoint)
    })

    it('should return the config endpoint + /msg if no inbound connection is available', () => {
      const endpoint = 'https://local-url.com'

      const agentConfig = new AgentConfig(
        getBaseConfig('AgentConfig Test', {
          endpoint,
        })
      )

      expect(agentConfig.getEndpoint()).toBe(endpoint + '/msg')
    })

    it('should return the config host + /msg if no inbound connection or config endpoint is available', () => {
      const host = 'https://local-url.com'

      const agentConfig = new AgentConfig(
        getBaseConfig('AgentConfig Test', {
          host,
        })
      )

      expect(agentConfig.getEndpoint()).toBe(host + '/msg')
    })

    it('should return the config host and port + /msg if no inbound connection or config endpoint is available', () => {
      const host = 'https://local-url.com'
      const port = 8080

      const agentConfig = new AgentConfig(
        getBaseConfig('AgentConfig Test', {
          host,
          port,
        })
      )

      expect(agentConfig.getEndpoint()).toBe(`${host}:${port}/msg`)
    })

    // added because on first implementation this is what it did. Never again!
    it('should return the endpoint + /msg without port if the endpoint and port are available', () => {
      const endpoint = 'https://local-url.com'
      const port = 8080

      const agentConfig = new AgentConfig(
        getBaseConfig('AgentConfig TesT', {
          endpoint,
          port,
        })
      )

      expect(agentConfig.getEndpoint()).toBe(`${endpoint}/msg`)
    })

    it("should return 'didcomm:transport/queue' if no inbound connection or config endpoint or host/port is available", () => {
      const agentConfig = new AgentConfig(getBaseConfig('AgentConfig Test'))

      expect(agentConfig.getEndpoint()).toBe('didcomm:transport/queue')
    })
  })
})
