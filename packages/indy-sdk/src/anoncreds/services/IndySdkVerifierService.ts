import type { AnonCredsVerifierService, VerifyProofOptions } from '@aries-framework/anoncreds'
import type { AgentContext } from '@aries-framework/core'
import type { CredentialDefs, Schemas, RevocRegDefs, RevRegs, IndyProofRequest, IndyProof } from 'indy-sdk'

import { inject, injectable } from '@aries-framework/core'

import { IndySdkError, isIndyError } from '../../error'
import { IndySdk, IndySdkSymbol } from '../../types'
import { parseCredentialDefinitionId } from '../utils/identifiers'
import {
  indySdkCredentialDefinitionFromAnonCreds,
  indySdkRevocationRegistryDefinitionFromAnonCreds,
  indySdkRevocationRegistryFromAnonCreds,
  indySdkSchemaFromAnonCreds,
} from '../utils/transform'

@injectable()
export class IndySdkVerifierService implements AnonCredsVerifierService {
  private indySdk: IndySdk

  public constructor(@inject(IndySdkSymbol) indySdk: IndySdk) {
    this.indySdk = indySdk
  }

  public async verifyProof(agentContext: AgentContext, options: VerifyProofOptions): Promise<boolean> {
    try {
      // The AnonCredsSchema doesn't contain the seqNo anymore. However, the indy credential definition id
      // does contain the seqNo, so we can extract it from the credential definition id.
      const seqNoMap: { [schemaId: string]: number } = {}

      // Convert AnonCreds credential definitions to Indy credential definitions
      const indyCredentialDefinitions: CredentialDefs = {}
      for (const credentialDefinitionId in options.credentialDefinitions) {
        const credentialDefinition = options.credentialDefinitions[credentialDefinitionId]

        indyCredentialDefinitions[credentialDefinitionId] = indySdkCredentialDefinitionFromAnonCreds(
          credentialDefinitionId,
          credentialDefinition
        )

        // Get the seqNo for the schemas so we can use it when transforming the schemas
        const { schemaSeqNo } = parseCredentialDefinitionId(credentialDefinitionId)
        seqNoMap[credentialDefinition.schemaId] = Number(schemaSeqNo)
      }

      // Convert AnonCreds schemas to Indy schemas
      const indySchemas: Schemas = {}
      for (const schemaId in options.schemas) {
        const schema = options.schemas[schemaId]
        indySchemas[schemaId] = indySdkSchemaFromAnonCreds(schemaId, schema, seqNoMap[schemaId])
      }

      // Convert AnonCreds revocation definitions to Indy revocation definitions
      const indyRevocationDefinitions: RevocRegDefs = {}
      const indyRevocationRegistries: RevRegs = {}

      for (const revocationRegistryDefinitionId in options.revocationRegistries) {
        const { definition, revocationStatusLists } = options.revocationRegistries[revocationRegistryDefinitionId]
        indyRevocationDefinitions[revocationRegistryDefinitionId] = indySdkRevocationRegistryDefinitionFromAnonCreds(
          revocationRegistryDefinitionId,
          definition
        )

        // Initialize empty object for this revocation registry
        indyRevocationRegistries[revocationRegistryDefinitionId] = {}

        // Also transform the revocation lists for the specified timestamps into the revocation registry
        // format Indy expects
        for (const timestamp in revocationStatusLists) {
          const revocationStatusList = revocationStatusLists[timestamp]
          indyRevocationRegistries[revocationRegistryDefinitionId][timestamp] =
            indySdkRevocationRegistryFromAnonCreds(revocationStatusList)
        }
      }

      return await this.indySdk.verifierVerifyProof(
        options.proofRequest as IndyProofRequest,
        options.proof as IndyProof,
        indySchemas,
        indyCredentialDefinitions,
        indyRevocationDefinitions,
        indyRevocationRegistries
      )
    } catch (error) {
      throw isIndyError(error) ? new IndySdkError(error) : error
    }
  }
}
