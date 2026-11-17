import { Agent } from '@credo-ts/core'

import { getAgentOptions } from '../../core/tests/helpers'
import { CheqdAnonCredsRegistry } from '../src/anoncreds'
import { getCheqdModules } from './setupCheqdModule'

// Reads data other software wrote to the public testnet, so it needs the network and the data to still be there (testnet
// has been reset before). Set RUN_LIVE_COMPAT=true to run it. Read-only: the payer seed is never used.
const live = process.env.RUN_LIVE_COMPAT === 'true'

// Real revocation registries found on testnet: each has a definition and a status list under the same name
const revocationRegistries = [
  {
    collection: '82dc285c-21ad-4b85-8f9c-ceae72c2f338',
    resource: '42ce159e-ec35-4ab5-a3b5-301494043fc4',
    length: 1000,
  },
  { collection: '45864376-b4fd-45a8-a374-628d15eb1b3e', resource: '2ba178bc-ce25-4d28-8fa5-555057976770', length: 10 },
  { collection: 'bf2d7da8-0f79-43cc-8126-cb176e589c5c', resource: '211662cb-374f-4ad6-b149-ba61a9695534', length: 100 },
]

describe.skipIf(!live)('Reading what other software wrote to the public testnet', () => {
  const agent = new Agent(
    getAgentOptions('Live compat', {}, {}, getCheqdModules(undefined, 'https://rpc.cheqd.network'))
  )
  const registry = new CheqdAnonCredsRegistry()

  beforeAll(() => agent.initialize())
  afterAll(() => agent.shutdown())

  it.each(revocationRegistries)(
    'reads revocation registry $collection and its status list',
    async ({ collection, resource, length }) => {
      const did = `did:cheqd:testnet:${collection}`
      const id = `${did}/resources/${resource}`

      const definition = await registry.getRevocationRegistryDefinition(agent.context, id)
      expect(definition.revocationRegistryDefinition?.issuerId).toBe(did)

      // The status list is found by the name of the definition, as written by the software that created it
      const statusList = await registry.getRevocationStatusList(agent.context, id, Math.floor(Date.now() / 1000))
      expect(statusList.revocationStatusList?.revocationList).toHaveLength(length)
    }
  )
})
