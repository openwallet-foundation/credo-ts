import type * as Indy from 'indy-sdk'

import { Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from '../../../agent/AgentConfig'
import { IndySdkError } from '../../../error'
import { isIndyError } from '../../../utils/indyError'

import { IndyLedgerService } from '../../ledger/services/IndyLedgerService'

@scoped(Lifecycle.ContainerScoped)
export class IndyVerifierService {
  private indy: typeof Indy
  private ledgerService: IndyLedgerService

  public constructor(agentConfig: AgentConfig, ledgerService: IndyLedgerService) {
    this.indy = agentConfig.agentDependencies.indy
    this.ledgerService = ledgerService
  }

  public async verifyProof({
    proofRequest,
    proof,
    schemas,
    credentialDefinitions
  }: VerifyProofOptions): Promise<boolean> {
    try {

      const { revocationRegistryDefinitions, revocationRegistryStates } = await this.getRevocationRegistries(proof)
      
      return await this.indy.verifierVerifyProof(
        proofRequest,
        proof,
        schemas,
        credentialDefinitions,
        revocationRegistryDefinitions,
        revocationRegistryStates
      )
    } catch (error) {
      throw isIndyError(error) ? new IndySdkError(error) : error
    }
  }

  private async getRevocationRegistries(proof: Indy.IndyProof) {
    let revocationRegistryDefinitions:Indy.RevocRegDefs = {}
    let revocationRegistryStates:Indy.RevStates = {}
    for(const identifier of proof.identifiers){
      const revRegId = identifier.rev_reg_id
      const timestamp = identifier.timestamp

      //Fetch Revocation Registry Definition if not already fetched
      if(revRegId && !revocationRegistryDefinitions[revRegId]){
        const { revocRegDef } = await this.ledgerService.getRevocationRegistryDefinition(revRegId)
        revocationRegistryDefinitions[revRegId] = revocRegDef
      }

      //Fetch Revocation Registry by Timestamp if not already fetched
      if(revRegId && timestamp && !revocationRegistryStates[revRegId]?.[timestamp]){
        if(!revocationRegistryStates[revRegId]){
          revocationRegistryStates[revRegId] = {}
        }
        const { revocReg } = await this.ledgerService.getRevocationRegistry(revRegId, timestamp)
        revocationRegistryStates[revRegId][timestamp] = revocReg
      }
    }
    return { revocationRegistryDefinitions, revocationRegistryStates }
  }
}

export interface VerifyProofOptions {
  proofRequest: Indy.IndyProofRequest
  proof: Indy.IndyProof
  schemas: Indy.Schemas
  credentialDefinitions: Indy.CredentialDefs
}
