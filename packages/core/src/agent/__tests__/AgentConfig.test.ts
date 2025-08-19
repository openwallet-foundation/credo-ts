import { agentDependencies } from '../../../tests/helpers'
import { AgentConfig } from '../AgentConfig'

describe('AgentConfig', () => {
  describe('extend()', () => {
    it('extends the existing AgentConfig', () => {
      const agentConfig = new AgentConfig(
        {
          allowInsecureHttpUrls: true,
          autoUpdateStorageOnStartup: true,
        },
        agentDependencies
      )

      const newAgentConfig = agentConfig.extend({})

      expect(newAgentConfig).toMatchObject({
        allowInsecureHttpUrls: true,
        autoUpdateStorageOnStartup: true,
      })
    })

    it('takes the init config from the extend method', () => {
      const agentConfig = new AgentConfig(
        {
          allowInsecureHttpUrls: false,
          autoUpdateStorageOnStartup: false,
        },
        agentDependencies
      )

      const newAgentConfig = agentConfig.extend({
        allowInsecureHttpUrls: false,
        autoUpdateStorageOnStartup: true,
      })

      expect(newAgentConfig).toMatchObject({
        allowInsecureHttpUrls: false,
        autoUpdateStorageOnStartup: true,
      })
    })
  })
})
