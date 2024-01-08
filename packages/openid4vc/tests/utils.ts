import type { BaseAgent, EmptyModuleMap, KeyDidCreateOptions, ModulesMap } from '@aries-framework/core'
import type { TenantsModule } from '@aries-framework/tenants'

import { Agent, DidKey, KeyType, TypedArrayEncoder, utils } from '@aries-framework/core'
import { agentDependencies } from '@aries-framework/node'

export async function createDidKidVerificationMethod<M extends EmptyModuleMap, A extends BaseAgent<M>>(
  agent: A,
  secretKey: string
) {
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
    config: { label, walletConfig: { id: utils.uuid(), key: utils.uuid() } },
    dependencies: agentDependencies,
    modules: modulesMap,
  })

  await agent.initialize()
  const data = await createDidKidVerificationMethod<MM, typeof agent>(agent, secretKey)

  return {
    ...data,
    agent,
  }
}

export type AgentType<MM extends ModulesMap> = Awaited<ReturnType<typeof createAgentFromModules<MM>>>

export async function createTenantForAgent<MM extends ModulesMap>(
  agent: Agent<{ tenants: TenantsModule<MM> }>,
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
  const data = await createDidKidVerificationMethod<MM, typeof tenant>(tenant, secretKey)
  await tenant.endSession()

  return {
    ...data,
    tenantId: tenantRecord.id,
  }
}

export type TenantType<MM extends ModulesMap> = Awaited<ReturnType<typeof createTenantForAgent<MM>>>
