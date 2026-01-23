import { cheqdAnonCredsRegistryTest } from './cheqd-sdk-anoncreds-registry-base'
import { cheqdPayerSeeds } from './setupCheqdModule'

cheqdAnonCredsRegistryTest(true, cheqdPayerSeeds[4])
