import type { Logger } from '../logger'
import type { TagsBase } from './BaseRecord'

import { inject, injectable } from 'tsyringe'

import { EventEmitter } from '../agent/EventEmitter'
import { InjectionSymbols } from '../constants'

import { BaseRecord } from './BaseRecord'
import { Repository } from './Repository'
import { StorageService } from './StorageService'

export type CustomMessageIdTags = TagsBase
export type DefaultMessageIdTags = TagsBase
export type MessageIdRecordProps = {
  id: string
}

export class ReceivedMessageIdRecord extends BaseRecord<DefaultMessageIdTags, CustomMessageIdTags> {
  public constructor(props: MessageIdRecordProps) {
    super()

    if (props) {
      this.id = props.id
    }
  }

  public getTags(): TagsBase {
    return {
      ...this._tags,
    }
  }
}

@injectable()
export class ReceivedMessageIdsRepository extends Repository<ReceivedMessageIdRecord> {
  public constructor(
    @inject(InjectionSymbols.StorageService) storageService: StorageService<ReceivedMessageIdRecord>,
    eventEmitter: EventEmitter
  ) {
    super(ReceivedMessageIdRecord, storageService, eventEmitter)
  }
}
