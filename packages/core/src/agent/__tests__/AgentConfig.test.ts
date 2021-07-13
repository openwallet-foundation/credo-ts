import { getAgentConfig } from '../../../tests/helpers'

describe('AgentConfig', () => {
  describe('getEndpoint', () => {
    it('should return the config endpoint if no inbound connection is available', () => {
      const endpoint = 'https://local-url.com'

      const agentConfig = getAgentConfig('AgentConfig Test', {
        endpoint,
      })

      expect(agentConfig.getEndpoint()).toBe(endpoint)
    })

    it('should return the config host if no inbound connection or config endpoint is available', () => {
      const host = 'https://local-url.com'
      const port = '3001'

      const agentConfig = getAgentConfig('AgentConfig Test', {
        host,
        port,
      })

      expect(agentConfig.getEndpoint()).toBe(host + ':' + port)
    })

    it('should return the config host and port if no inbound connection or config endpoint is available', () => {
      const host = 'https://local-url.com'
      const port = 8080

      const agentConfig = getAgentConfig('AgentConfig Test', {
        host,
        port,
      })

      expect(agentConfig.getEndpoint()).toBe(`${host}:${port}`)
    })

    // added because on first implementation this is what it did. Never again!
    it('should return the endpoint without port if the endpoint and port are available', () => {
      const endpoint = 'https://local-url.com'
      const port = 8080

      const agentConfig = getAgentConfig('AgentConfig TesT', {
        endpoint,
        port,
      })

      expect(agentConfig.getEndpoint()).toBe(`${endpoint}`)
    })

    it("should return 'didcomm:transport/queue' if no inbound connection or config endpoint or host/port is available", () => {
      const agentConfig = getAgentConfig('AgentConfig Test')

      expect(agentConfig.getEndpoint()).toBe('didcomm:transport/queue')
    })
  })
})
