import type { Buffer } from '../../../utils'
import type { CryptoInterface } from '@value-transfer/value-transfer-lib'

import { Lifecycle, scoped } from 'tsyringe'

import { KeyType } from '../../../crypto'
import { DidService } from '../../dids/services/DidService'
import { KeyService } from '../../keys'

@scoped(Lifecycle.ContainerScoped)
export class ValueTransferCryptoService implements CryptoInterface {
  private didService: DidService
  private keysService: KeyService

  public constructor(didService: DidService, keysService: KeyService) {
    this.didService = didService
    this.keysService = keysService
  }

  // FIXME: realize how to avoid @ts-ignore annotation
  // @ts-ignore
  public async sign(payload: Buffer, did: string): Promise<Buffer> {
    const kid = (await this.didService.getDIDDoc(did)).verificationKeyId
    return await this.keysService.sign({ payload, kid })
  }

  // @ts-ignore
  public async verify(payload: Buffer, signature: Buffer, did: string): Promise<boolean> {
    const key = (await this.didService.getDIDDoc(did)).getVerificationMethod()
    return this.keysService.verify({ payload, signature, key })
  }

  // @ts-ignore
  public async encrypt(payload: Buffer, senderDID: string, recipientDID: string): Promise<Buffer> {
    const senderKid = (await this.didService.getDIDDoc(senderDID)).agreementKeyId
    const recipientKey = (await this.didService.getDIDDoc(recipientDID)).getKeyAgreement()
    return this.keysService.encrypt({ payload, senderKid, recipientKey })
  }

  // @ts-ignore
  public async decrypt(payload: Buffer, senderDID: string, recipientDID: string): Promise<Buffer> {
    const recipientKid = (await this.didService.getDIDDoc(recipientDID)).agreementKeyId
    const senderKey = (await this.didService.getDIDDoc(senderDID)).getKeyAgreement()
    return this.keysService.decrypt({ payload, senderKey, recipientKid })
  }
}
