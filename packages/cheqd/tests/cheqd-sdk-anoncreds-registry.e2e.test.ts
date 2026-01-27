import { cheqdAnonCredsRegistryTest } from './cheqd-sdk-anoncreds-registry-base'
import { cheqdPayerSeeds } from './setupCheqdModule'

describe('Cheqd AnonCreds Registry Sequential Tests', () => {
  describe('Without Cache', () => {
    cheqdAnonCredsRegistryTest(false, cheqdPayerSeeds[2])
  })

  describe('With Cache', () => {
    // This will only start after the "Without Cache" suite finishes
    cheqdAnonCredsRegistryTest(true, cheqdPayerSeeds[4])
  })
})
