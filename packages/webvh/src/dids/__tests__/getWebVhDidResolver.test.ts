import { AgentConfig, DependencyManager, DidsModule, DidsModuleConfig } from '@credo-ts/core'

import { agentDependencies, getAgentContext } from '../../../../core/tests/helpers'
import { WebVhAnonCredsRegistry } from '../../anoncreds/services/WebVhAnonCredsRegistry'
import { WebVhApi } from '../../WebVhApi'
import { WebVhModule } from '../../WebVhModule'
import { getWebVhDidResolver } from '../getWebVhDidResolver'
import { WebVhDidRegistrar } from '../WebVhDidRegistrar'
import { WebVhDidResolver } from '../WebVhDidResolver'

function registerModules(didsModule: DidsModule, agentConfig?: AgentConfig) {
  const dependencyManager = new DependencyManager()
  dependencyManager.registerModules({ dids: didsModule, webvh: new WebVhModule() })
  return getAgentContext({ dependencyManager, agentConfig })
}

describe('getWebVhDidResolver', () => {
  test('registers the API once and scopes its instance to each agent context', () => {
    const dependencyManager = new DependencyManager()
    const registerContextScoped = vi.spyOn(dependencyManager, 'registerContextScoped')
    dependencyManager.registerModules({ dids: new DidsModule(), webvh: new WebVhModule() })
    expect(registerContextScoped.mock.calls.filter(([token]) => token === WebVhApi)).toHaveLength(1)

    const firstContext = getAgentContext({ dependencyManager: dependencyManager.createChild() })
    const secondContext = getAgentContext({ dependencyManager: dependencyManager.createChild() })
    const firstApi = firstContext.resolve(WebVhApi)
    const secondApi = secondContext.resolve(WebVhApi)
    expect(firstApi).toBeInstanceOf(WebVhApi)
    expect(secondApi).toBeInstanceOf(WebVhApi)
    expect(firstContext.resolve(WebVhApi)).toBe(firstApi)
    expect(secondContext.resolve(WebVhApi)).toBe(secondApi)
    expect(firstApi).not.toBe(secondApi)
  })

  test('returns the resolver configured on the DidsModule', () => {
    const resolver = new WebVhDidResolver()
    const agentContext = registerModules(new DidsModule({ resolvers: [resolver] }))

    expect(getWebVhDidResolver(agentContext)).toBe(resolver)
    expect(agentContext.resolve(DidsModuleConfig).resolvers.filter((r) => r instanceof WebVhDidResolver)).toHaveLength(
      1
    )
  })

  test('applies the agent fetch byte limit through the API and AnonCreds registry', async () => {
    const fetch = vi.fn(async () => new Response('1234', { headers: { 'content-type': 'text/plain' } }))
    const config = new AgentConfig({ fetchLimits: { maxResponseBytes: 4 } }, { ...agentDependencies, fetch })
    const resolver = new WebVhDidResolver()
    const context = registerModules(new DidsModule({ resolvers: [resolver] }), config)
    const resource = 'did:webvh:QmdmPkUdYzbr9txmx8gM2rsHPgr5L6m3gHjJGAf4vUFoGE:example.com/resources/1234'
    const api = new WebVhApi(context)
    expect(await api.resolveResource(resource)).toMatchObject({ content: '1234' })
    fetch.mockImplementation(async () => new Response('12345', { headers: { 'content-type': 'text/plain' } }))
    const oversized = await api.resolveResource(resource)
    expect(oversized).toMatchObject({ error: 'notFound', message: expect.stringContaining('4') })
    const schema = await new WebVhAnonCredsRegistry().getSchema(context, resource)
    expect(schema.resolutionMetadata).toMatchObject({
      error: 'invalid',
      message: expect.stringContaining('Response exceeded limit of 4 bytes'),
    })
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  test('returns the resolver the WebVhModule adds when the DidsModule has none', () => {
    const agentContext = registerModules(new DidsModule())

    const resolver = getWebVhDidResolver(agentContext)
    expect(agentContext.resolve(DidsModuleConfig).resolvers).toContain(resolver)
    expect(
      agentContext.resolve(DidsModuleConfig).registrars.filter((r) => r instanceof WebVhDidRegistrar)
    ).toHaveLength(1)
  })

  test('preserves configured WebVH adapters and does not duplicate them when registering again', () => {
    const registrar = new WebVhDidRegistrar()
    const resolver = new WebVhDidResolver()
    const context = registerModules(new DidsModule({ registrars: [registrar], resolvers: [resolver] }))
    new WebVhModule().register(context.dependencyManager)
    const config = context.resolve(DidsModuleConfig)
    expect(config.registrars.filter((r) => r.supportedMethods.includes('webvh'))).toEqual([registrar])
    expect(config.resolvers.filter((r) => r instanceof WebVhDidResolver)).toEqual([resolver])
  })

  test('throws when no WebVhDidResolver is registered', () => {
    const agentContext = getAgentContext({ registerInstances: [[DidsModuleConfig, new DidsModuleConfig()]] })

    expect(() => getWebVhDidResolver(agentContext)).toThrow('No WebVhDidResolver registered on the DidsModule')
  })
})
