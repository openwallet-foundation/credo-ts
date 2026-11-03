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

  describe('fetch', () => {
    const fetch = vi.fn(async () => new Response(new Blob([new Uint8Array(1000)])))
    const dependencies = { ...agentDependencies, fetch: fetch as unknown as typeof globalThis.fetch }

    it('applies the fetch limits to the fetch of the agent dependencies', async () => {
      const agentConfig = new AgentConfig({ fetchLimits: { maxResponseBytes: 100 } }, dependencies)

      await expect(agentConfig.agentDependencies.fetch('https://example.com')).rejects.toThrow(/exceeded limit/)
    })

    it('limits responses to 10 MiB by default', () => {
      const agentConfig = new AgentConfig({}, dependencies)

      expect(agentConfig.fetchLimits).toEqual({ maxResponseBytes: 10 * 1024 * 1024, timeoutMs: 30000 })
    })

    it('allows overriding the fetch limits for a single request', async () => {
      const agentConfig = new AgentConfig({ fetchLimits: { maxResponseBytes: 100 } }, dependencies)

      const response = await agentConfig.fetch('https://example.com', { maxResponseBytes: 1000 })
      expect((await response.arrayBuffer()).byteLength).toBe(1000)
    })

    it('does not apply the fetch limits of the original config after extending', async () => {
      const agentConfig = new AgentConfig({ fetchLimits: { maxResponseBytes: 100 } }, dependencies)

      const response = await agentConfig
        .extend({ fetchLimits: { maxResponseBytes: 1000 } })
        .agentDependencies.fetch('https://example.com')
      expect((await response.arrayBuffer()).byteLength).toBe(1000)
    })
  })
})
