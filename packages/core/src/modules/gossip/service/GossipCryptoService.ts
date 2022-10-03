import type { Buffer } from '../../../utils'
import type { GossipCryptoInterface } from '@sicpa-dlab/value-transfer-protocol-ts'

import { injectable } from '../../../plugins'
import { DidService } from '../../dids/services/DidService'
import { KeyService } from '../../keys'

@injectable()
export class GossipCryptoService implements GossipCryptoInterface {
  private didService: DidService
  private keysService: KeyService

  public constructor(didService: DidService, keysService: KeyService) {
    this.didService = didService
    this.keysService = keysService
  }

  public async signByDid(payload: Buffer, did: string): Promise<Buffer> {
    const didDoc = await this.didService.getDIDDoc(did)
    const kid = didDoc.verificationKeyId || didDoc.authenticationKeyId
    if (!kid) {
      throw new Error(`Unable to locate signing key for DID '${did}'`)
    }
    return await this.keysService.sign({ payload, kid })
  }

  public async verifyByDid(payload: Buffer, signature: Buffer, did: string): Promise<boolean> {
    const didDoc = await this.didService.getDIDDoc(did)
    const key = didDoc.getVerificationMethod() || didDoc.getAuthentication()
    if (!key) {
      throw new Error(`Unable to locate verification key for DID '${did}'`)
    }
    return this.keysService.verify({ payload, signature, key })
  }
}
