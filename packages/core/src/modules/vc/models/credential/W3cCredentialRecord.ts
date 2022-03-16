import type { TagsBase } from '../../../../storage/BaseRecord'

import { BaseRecord } from '../../../../storage/BaseRecord'

export class W3cCredentialRecord extends BaseRecord {
  public getTags(): TagsBase {
    throw new Error('Method not implemented.')
  }
}
