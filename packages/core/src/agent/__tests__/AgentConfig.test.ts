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

    it('should return the new config endpoint after setter is called', () => {
      const endpoint = 'https://local-url.com'
      const newEndpoint = 'https://new-local-url.com'

      const agentConfig = getAgentConfig('AgentConfig Test', {
        endpoints: [endpoint],
      })

      agentConfig.endpoints = [newEndpoint]
      expect(agentConfig.endpoints).toEqual([newEndpoint])
    })
  })

  describe('label', () => {
    it('should return new label after setter is called', async () => {
      expect.assertions(2)
      const newLabel = 'Agent: Agent Class Test 2'

      const agentConfig = getAgentConfig('AgentConfig Test', {
        label: 'Test',
      })
      expect(agentConfig.label).toBe('Test')

      agentConfig.label = newLabel
      expect(agentConfig.label).toBe(newLabel)
    })
  })

  describe('extend()', () => {
    it('extends the existing AgentConfig', () => {
      const agentConfig = new AgentConfig(
        {
          label: 'hello',
        },
        agentDependencies
      )

      const newAgentConfig = agentConfig.extend({})

      expect(newAgentConfig).toMatchObject({
        label: 'hello',
      })
    })

    it('takes the init config from the extend method', () => {
      const agentConfig = new AgentConfig(
        {
          label: 'hello',
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
      })
    })
  })
})
