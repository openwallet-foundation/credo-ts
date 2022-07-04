import { agentDependencies, getAgentConfig } from '../../../tests/helpers'
import { AgentConfig } from '../AgentConfig'

describe('AgentConfig', () => {
  describe('endpoints', () => {
    it('should return the config endpoint if no inbound connection is available', () => {
      const endpoint = 'https://local-url.com'

      const agentConfig = getAgentConfig('AgentConfig Test', {
        endpoints: [endpoint],
      })

      expect(agentConfig.endpoints).toEqual([endpoint])
    })

    it("should return ['didcomm:transport/queue'] if no inbound connection or config endpoint or host/port is available", () => {
      const agentConfig = getAgentConfig('AgentConfig Test')

      expect(agentConfig.endpoints).toStrictEqual(['didcomm:transport/queue'])
    })
  })

  describe('extend()', () => {
    it('extends the existing AgentConfig', () => {
      const agentConfig = new AgentConfig(
        {
          label: 'hello',
          publicDidSeed: 'hello',
        },
        agentDependencies
      )

      const newAgentConfig = agentConfig.extend({})

      expect(newAgentConfig).toMatchObject({
        label: 'hello',
        publicDidSeed: 'hello',
      })
    })

    it('takes the init config from the extend method', () => {
      const agentConfig = new AgentConfig(
        {
          label: 'hello',
          publicDidSeed: 'hello',
        },
        agentDependencies
      )

      const newAgentConfig = agentConfig.extend({
        label: 'anotherLabel',
        autoAcceptConnections: true,
      })

      expect(newAgentConfig).toMatchObject({
        label: 'anotherLabel',
        autoAcceptConnections: true,
        publicDidSeed: 'hello',
      })
    })
  })
})
