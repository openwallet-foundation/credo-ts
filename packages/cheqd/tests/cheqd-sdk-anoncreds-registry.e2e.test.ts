import { cheqdAnonCredsRegistryTest } from './cheqd-sdk-anoncreds-registry-base'
import { cheqdPayerSeeds } from './setupCheqdModule'

cheqdAnonCredsRegistryTest(false, cheqdPayerSeeds[2])
