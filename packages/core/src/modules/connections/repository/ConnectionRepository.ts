import { inject, scoped, Lifecycle } from 'tsyringe'

import { InjectionSymbols } from '../../../constants'
import { Repository } from '../../../storage/Repository'
import { StorageService } from '../../../storage/StorageService'

import { ConnectionRecord } from './ConnectionRecord'

@scoped(Lifecycle.ContainerScoped)
export class ConnectionRepository extends Repository<ConnectionRecord> {
  public constructor(@inject(InjectionSymbols.StorageService) storageService: StorageService<ConnectionRecord>) {
    super(ConnectionRecord, storageService)
  }

  public async findByDids({ ourDid, theirDid }: { ourDid: string; theirDid: string }) {
    return this.findSingleByQuery({
      did: ourDid,
      theirDid,
    })
  }

  public findByVerkey(verkey: string): Promise<ConnectionRecord | null> {
    return this.findSingleByQuery({
      verkey,
    })
  }

  public findByTheirKey(verkey: string): Promise<ConnectionRecord | null> {
    return this.findSingleByQuery({
      theirKey: verkey,
    })
  }

  public findByInvitationKey(key: string): Promise<ConnectionRecord | null> {
    return this.findSingleByQuery({
      invitationKey: key,
    })
  }

  public getByThreadId(threadId: string): Promise<ConnectionRecord> {
    return this.getSingleByQuery({ threadId })
  }
}
