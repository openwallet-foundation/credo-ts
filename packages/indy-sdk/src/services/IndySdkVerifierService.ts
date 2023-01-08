import type { VerifyProofMetadata } from './IndySdkVerifierServiceMetadata'
import type { AnonCredsVerifierService, VerifyProofOptions } from '@aries-framework/anoncreds'
import type * as Indy from 'indy-sdk'

import { AgentDependencies, AriesFrameworkError, inject, InjectionSymbols } from '@aries-framework/core'

import { IndySdkError, isIndyError } from '../error'

export class IndySdkVerifierService implements AnonCredsVerifierService {
  private indy: typeof Indy

  public constructor(@inject(InjectionSymbols.AgentDependencies) agentDependencies: AgentDependencies) {
    this.indy = agentDependencies.indy
  }

  public async verifyProof(options: VerifyProofOptions, metadata?: VerifyProofMetadata): Promise<boolean> {
    if (!metadata) {
      throw new AriesFrameworkError('The metadata parameter is required when using Indy, but received undefined.')
    }

    try {
      // Convert AnonCreds revocation definitions to Indy revocation definitions

      const revocationDefinitions: Indy.RevocRegDefs = {}

      for (const key in options.revocationStates) {
        const definition = options.revocationStates[key].definition

        revocationDefinitions[key] = {
          id: key, // TODO verify this is right
          credDefId: definition.credDefId,
          revocDefType: definition.type,
          tag: definition.tag,
          value: {
            issuanceType: metadata.revocationRegistryDefinition[key].issuanceType,
            maxCredNum: definition.maxCredNum,
            publicKeys: [definition.publicKeys.accumKey.z],
            tailsHash: definition.tailsHash,
            tailsLocation: definition.tailsLocation,
          },
          ver: metadata.revocationRegistryDefinition[key].ver,
        }
      }

      // Convert AnonCreds schemas to Indy schemas

      const indySchemas: Indy.Schemas = {}

      for (const key in options.schemas) {
        indySchemas[key] = {
          id: key, // TODO verify this is correct
          name: options.schemas[key].name,
          version: options.schemas[key].version,
          attrNames: options.schemas[key].attrNames,
          seqNo: metadata.schemas[key].seqNo,
          ver: metadata.schemas[key].ver,
        }
      }

      // Convert AnonCreds credential definitions to Indy credential definitions

      const indyCredentialDefinitions: Indy.CredentialDefs = {}

      for (const key in options.credentialDefinitions) {
        indyCredentialDefinitions[key] = {
          id: key, // TODO verify this is correct
          schemaId: options.credentialDefinitions[key].schemaId,
          tag: options.credentialDefinitions[key].tag,
          type: options.credentialDefinitions[key].type,
          value: options.credentialDefinitions[key].value,
          ver: metadata.credentialDefinitions[key].ver,
        }
      }

      return await this.indy.verifierVerifyProof(
        options.proofRequest,
        options.proof,
        indySchemas,
        indyCredentialDefinitions,
        revocationDefinitions,
        options.revocationStates
      )
    } catch (error) {
      throw isIndyError(error) ? new IndySdkError(error) : error
    }
  }
}
