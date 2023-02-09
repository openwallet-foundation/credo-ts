import type { AnonCredsVerifierService, VerifyProofOptions } from '@aries-framework/anoncreds'

import { injectable } from '@aries-framework/core'
import {
  CredentialDefinition,
  Presentation,
  PresentationRequest,
  RevocationRegistryDefinition,
  RevocationStatusList,
  Schema,
} from '@hyperledger/anoncreds-shared'

import { AnonCredsRsError } from '../errors/AnonCredsRsError'

@injectable()
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
      const lists = []

      for (const revocationRegistryDefinitionId in revocationStates) {
        const { definition, revocationStatusLists } = options.revocationStates[revocationRegistryDefinitionId]

        revocationRegistryDefinitions[revocationRegistryDefinitionId] = RevocationRegistryDefinition.load(
          JSON.stringify(definition)
        )

        for (const timestamp in revocationStatusLists) {
          lists.push(
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
        presentationRequest: PresentationRequest.load(JSON.stringify(proofRequest)),
        credentialDefinitions: rsCredentialDefinitions,
        schemas: rsSchemas,
        revocationRegistryDefinitions,
        revocationStatusLists: lists,
      })
    } catch (error) {
      throw new AnonCredsRsError('Error verifying proof', { cause: error })
    }
  }
}
