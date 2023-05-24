import type { StoreCredentialOptions } from './W3cCredentialServiceOptions'
import type { W3cVerifiableCredential } from './models'
import type { W3cCredentialRecord } from './repository'
import type { Query } from '../../storage/StorageService'

import { AgentContext } from '../../agent'
import { injectable } from '../../plugins'

import { W3cCredentialService } from './W3cCredentialService'

/**
 * @public
 */
@injectable()
export class W3cCredentialsApi {
  private agentContext: AgentContext
  private w3cCredentialService: W3cCredentialService

  public constructor(agentContext: AgentContext, w3cCredentialService: W3cCredentialService) {
    this.agentContext = agentContext
    this.w3cCredentialService = w3cCredentialService
  }

  public async storeCredential(options: StoreCredentialOptions): Promise<W3cCredentialRecord> {
    return this.w3cCredentialService.storeCredential(this.agentContext, options)
  }

  public async removeCredentialRecord(id: string) {
    return this.w3cCredentialService.removeCredentialRecord(this.agentContext, id)
  }

  public async getAllCredentialRecords(): Promise<W3cCredentialRecord[]> {
    return this.w3cCredentialService.getAllCredentialRecords(this.agentContext)
  }

  public async getCredentialRecordById(id: string): Promise<W3cCredentialRecord> {
    return this.w3cCredentialService.getCredentialRecordById(this.agentContext, id)
  }

  public async findCredentialRecordsByQuery(query: Query<W3cCredentialRecord>): Promise<W3cVerifiableCredential[]> {
    return this.w3cCredentialService.findCredentialsByQuery(this.agentContext, query)
  }
}
