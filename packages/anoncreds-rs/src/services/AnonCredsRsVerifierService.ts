import type { AnonCredsVerifierService, VerifyProofOptions } from '@aries-framework/anoncreds'
import type { AgentContext } from '@aries-framework/core'
import type { JsonObject } from '@hyperledger/anoncreds-shared'

import { injectable } from '@aries-framework/core'
import { Presentation } from '@hyperledger/anoncreds-shared'

@injectable()
export class AnonCredsRsVerifierService implements AnonCredsVerifierService {
  public async verifyProof(agentContext: AgentContext, options: VerifyProofOptions): Promise<boolean> {
    const { credentialDefinitions, proof, proofRequest, revocationRegistries, schemas } = options

    let presentation: Presentation | undefined
    try {
      presentation = Presentation.fromJson(proof as unknown as JsonObject)

      const rsCredentialDefinitions: Record<string, JsonObject> = {}
      for (const credDefId in credentialDefinitions) {
        rsCredentialDefinitions[credDefId] = credentialDefinitions[credDefId] as unknown as JsonObject
      }

      const rsSchemas: Record<string, JsonObject> = {}
      for (const schemaId in schemas) {
        rsSchemas[schemaId] = schemas[schemaId] as unknown as JsonObject
      }

      const revocationRegistryDefinitions: Record<string, JsonObject> = {}
      const lists: JsonObject[] = []

      for (const revocationRegistryDefinitionId in revocationRegistries) {
        const { definition, revocationStatusLists } = options.revocationRegistries[revocationRegistryDefinitionId]

        revocationRegistryDefinitions[revocationRegistryDefinitionId] = definition as unknown as JsonObject

        lists.push(...(Object.values(revocationStatusLists) as unknown as Array<JsonObject>))
      }

      return presentation.verify({
        presentationRequest: proofRequest as unknown as JsonObject,
        credentialDefinitions: rsCredentialDefinitions,
        schemas: rsSchemas,
        revocationRegistryDefinitions,
        revocationStatusLists: lists,
      })
    } finally {
      presentation?.handle.clear()
    }
  }
}
