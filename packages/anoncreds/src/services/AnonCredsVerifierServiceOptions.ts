import type { AnonCredsProof, AnonCredsProofRequest } from '../models/exchange'
import type {
  AnonCredsCredentialDefinition,
  AnonCredsRevocationStatusList,
  AnonCredsRevocationRegistryDefinition,
  AnonCredsSchema,
} from '../models/registry'

export interface VerifyProofOptions {
  proofRequest: AnonCredsProofRequest
  proof: AnonCredsProof
  schemas: {
    [schemaId: string]: AnonCredsSchema
  }
  credentialDefinitions: {
    [credentialDefinitionId: string]: AnonCredsCredentialDefinition
  }
  revocationRegistries: {
    [revocationRegistryDefinitionId: string]: {
      definition: AnonCredsRevocationRegistryDefinition
      // NOTE: the verifier only needs the accumulator, not the whole state of the revocation registry
      // Requiring this to be the full state means we need to retrieve the full state from the ledger
      // as a verifier. This is just following the data models from the AnonCreds spec, but for e.g. indy
      // this means we need to retrieve _ALL_ deltas from the ledger to verify a proof. While currently we
      // only need to fetch the registry.
      revocationStatusLists: {
        [timestamp: number]: AnonCredsRevocationStatusList
      }
    }
  }
}
