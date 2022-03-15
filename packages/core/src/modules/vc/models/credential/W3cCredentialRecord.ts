import type { TagsBase } from '../../../../storage/BaseRecord'

import { Type } from 'class-transformer'

import { BaseRecord } from '../../../../storage/BaseRecord'

import { W3cVerifiableCredential } from './W3cVerifiableCredential'

export interface W3cCredentialRecordOptions {
  credential: W3cVerifiableCredential
}

/**
 * K-TODO: Set the appropriate tags
 * @see https://github.com/hyperledger/aries-cloudagent-python/blob/e77d087bdd5f1f803616730e33d4e3f0801b5f8d/aries_cloudagent/storage/vc_holder/xform.py
 *
 * NOTE: Credential.type entries need to be expanded before storing them as tags
 */
export class W3cCredentialRecord extends BaseRecord {
  public constructor(options: W3cCredentialRecordOptions) {
    super()
    if (options) {
      this.credential = options.credential
    }
  }

  @Type(() => W3cVerifiableCredential)
  public credential!: W3cVerifiableCredential

  public getTags(): TagsBase {
    return {
      ...this._tags,
    }
  }
}
