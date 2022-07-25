import type { Buffer } from '../../../utils'
import type { CryptoInterface } from '@sicpa-dlab/value-transfer-protocol-ts'

import { Lifecycle, scoped } from 'tsyringe'

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

  public async sign(payload: Buffer, did: string): Promise<Buffer> {
    const didDoc = await this.didService.getDIDDoc(did)
    const kid = didDoc.verificationKeyId || didDoc.authenticationKeyId
    if (!kid) {
      throw new Error(`Unable to locate signing key for DID '${did}'`)
    }
    return await this.keysService.sign({ payload, kid })
  }

  public async verify(payload: Buffer, signature: Buffer, did: string): Promise<boolean> {
    const didDoc = await this.didService.getDIDDoc(did)
    const key = didDoc.getVerificationMethod() || didDoc.getAuthentication()
    if (!key) {
      throw new Error(`Unable to locate verification key for DID '${did}'`)
    }
    return this.keysService.verify({ payload, signature, key })
  }

  public async encrypt(payload: Buffer, senderDID: string, recipientDID: string): Promise<Buffer> {
    const senderKid = (await this.didService.getDIDDoc(senderDID)).agreementKeyId
    const recipientKey = (await this.didService.getDIDDoc(recipientDID)).getKeyAgreement()
    if (!senderKid) {
      throw new Error(`Unable to locate encryption key for DID '${senderDID}'`)
    }
    if (!recipientKey) {
      throw new Error(`Unable to locate encryption key for DID '${recipientKey}'`)
    }
    return this.keysService.encrypt({ payload, senderKid, recipientKey })
  }

  public async decrypt(payload: Buffer, senderDID: string, recipientDID: string): Promise<Buffer> {
    const recipientKid = (await this.didService.getDIDDoc(recipientDID)).agreementKeyId
    const senderKey = (await this.didService.getDIDDoc(senderDID)).getKeyAgreement()
    if (!recipientKid) {
      throw new Error(`Unable to locate encryption key for DID '${recipientDID}'`)
    }
    if (!senderKey) {
      throw new Error(`Unable to locate encryption key for DID '${senderKey}'`)
    }
    return this.keysService.decrypt({ payload, senderKey, recipientKid })
  }
}
