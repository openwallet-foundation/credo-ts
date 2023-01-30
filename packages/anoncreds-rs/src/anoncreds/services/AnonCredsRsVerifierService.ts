import type { AnonCredsVerifierService, VerifyProofOptions } from '@aries-framework/anoncreds'

import {
  CredentialDefinition,
  Presentation,
  PresentationRequest,
  RevocationRegistryDefinition,
  Schema,
} from '@hyperledger/anoncreds-shared'
// FIXME: import from '@hyperledger/anoncreds-shared
import { RevocationStatusList } from '@hyperledger/anoncreds-shared/build/api/RevocationStatusList'

import { AnonCredsRsError } from '../../errors/AnonCredsRsError'

export class AnonCredsRsVerifierService implements AnonCredsVerifierService {
  public async verifyProof(options: VerifyProofOptions): Promise<boolean> {
    const { credentialDefinitions, proof, proofRequest, revocationStates, schemas } = options

    try {
      const presentation = Presentation.load(JSON.stringify(proof))

      const rsCredentialDefinitions: Record<string, CredentialDefinition> = {}
      for (const credDefId in credentialDefinitions) {
        rsCredentialDefinitions[credDefId] = CredentialDefinition.load(JSON.stringify(credentialDefinitions[credDefId]))
      }

      const rsSchemas: Record<string, Schema> = {}
      for (const schemaId in schemas) {
        rsSchemas[schemaId] = Schema.load(JSON.stringify(schemas[schemaId]))
      }

      const revocationRegistryDefinitions: Record<string, RevocationRegistryDefinition> = {}
      const revocationStatusLists = []

      for (const revocationRegistryDefinitionId in revocationStates) {
        const { definition, revocationLists } = options.revocationStates[revocationRegistryDefinitionId]

        revocationRegistryDefinitions[revocationRegistryDefinitionId] =
          // TODO: remove as unknown once it is fixed in anoncreds-shared
          RevocationRegistryDefinition.load(JSON.stringify(definition)) as unknown as RevocationRegistryDefinition

        for (const timestamp in revocationLists) {
          revocationStatusLists.push(
            RevocationStatusList.create({
              issuanceByDefault: true,
              revocationRegistryDefinition: revocationRegistryDefinitions[revocationRegistryDefinitionId],
              revocationRegistryDefinitionId,
              timestamp: Number(timestamp),
            })
          )
        }
      }

      return presentation.verify({
        presentation: presentation, // FIXME: remove as soon as it is removed from anoncreds API
        presentationRequest: PresentationRequest.load(JSON.stringify(proofRequest)),
        credentialDefinitions: rsCredentialDefinitions,
        schemas: rsSchemas,
        revocationRegistryDefinitions,
        revocationStatusLists,
      })
    } catch (error) {
      throw new AnonCredsRsError('Error creating credential offer', { cause: error })
    }
  }
}