import type { AnonCredsProof, AnonCredsVerifierService, VerifyProofOptions } from '@credo-ts/anoncreds'
import type { AgentContext } from '@credo-ts/core'
import type { CredentialDefs, Schemas, RevocRegDefs, RevRegs, IndyProofRequest, IndyProof } from 'indy-sdk'

import { parseIndyCredentialDefinitionId } from '@credo-ts/anoncreds'
import { inject, injectable } from '@credo-ts/core'

import { IndySdkError, isIndyError } from '../../error'
import { IndySdk, IndySdkSymbol } from '../../types'
import { assertAllUnqualified } from '../utils/assertUnqualified'
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
    assertAllUnqualified({
      credentialDefinitionIds: Object.keys(options.credentialDefinitions),
      schemaIds: Object.keys(options.schemas),
      revocationRegistryIds: Object.keys(options.revocationRegistries),
    })

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
        const { schemaSeqNo } = parseIndyCredentialDefinitionId(credentialDefinitionId)
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
        // FIXME IndyProof if badly typed in indy-sdk. It contains a `requested_predicates` property, which should be `predicates`.
        options.proof as unknown as IndyProof,
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
