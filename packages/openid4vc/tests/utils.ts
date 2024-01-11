import type { TenantAgent } from '../../tenants/src/TenantAgent'
import type { KeyDidCreateOptions, ModulesMap } from '@aries-framework/core'
import type { TenantsModule } from '@aries-framework/tenants'

import { LogLevel, Agent, DidKey, KeyType, TypedArrayEncoder, utils } from '@aries-framework/core'
import { agentDependencies } from '@aries-framework/node'

import { TestLogger } from '../../core/tests/logger'

export async function createDidKidVerificationMethod(agent: Agent | TenantAgent, secretKey: string) {
  const didCreateResult = await agent.dids.create<KeyDidCreateOptions>({
    method: 'key',
    options: { keyType: KeyType.Ed25519 },
    secret: { privateKey: TypedArrayEncoder.fromString(secretKey) },
  })

  const did = didCreateResult.didState.did as string
  const didKey = DidKey.fromDid(did)
  const kid = `${did}#${didKey.key.fingerprint}`

  const verificationMethod = didCreateResult.didState.didDocument?.dereferenceKey(kid, ['authentication'])
  if (!verificationMethod) throw new Error('No verification method found')

  return {
    did,
    kid,
    verificationMethod,
  }
}

export async function createAgentFromModules<MM extends ModulesMap>(label: string, modulesMap: MM, secretKey: string) {
  const agent = new Agent<MM>({
    config: { label, walletConfig: { id: utils.uuid(), key: utils.uuid() }, logger: new TestLogger(LogLevel.off) },
    dependencies: agentDependencies,
    modules: modulesMap,
  })

  await agent.initialize()
  const data = await createDidKidVerificationMethod(agent, secretKey)

  return {
    ...data,
    agent,
  }
}

export type AgentType<MM extends ModulesMap> = Awaited<ReturnType<typeof createAgentFromModules<MM>>>

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AgentWithTenantsModule = Agent<{ tenants: TenantsModule<any> }>

export async function createTenantForAgent(
  // FIXME: we need to make some improvements on the agent typing. It'a quite hard
  // to get it right at the moment
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  agent: AgentWithTenantsModule & any,
  label: string
) {
  const tenantRecord = await agent.modules.tenants.createTenant({
    config: {
      label,
    },
  })

  const nonce1 = await agent.wallet.generateNonce()
  const nonce2 = await agent.wallet.generateNonce()
  const secretKey = (nonce1 + nonce2).slice(0, 32)

  const tenant = await agent.modules.tenants.getTenantAgent({ tenantId: tenantRecord.id })
  const data = await createDidKidVerificationMethod(tenant, secretKey)
  await tenant.endSession()

  return {
    ...data,
    tenantId: tenantRecord.id,
  }
}

export type TenantType = Awaited<ReturnType<typeof createTenantForAgent>>
