import { agentDependencies } from '../../../tests/helpers'
import { AgentConfig } from '../AgentConfig'

describe('AgentConfig', () => {
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
  })
})
