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

export class MessageIdRecord extends BaseRecord<DefaultMessageIdTags, CustomMessageIdTags> {
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
export class MessageIdsRepository extends Repository<MessageIdRecord> {
  public constructor(
    @inject(InjectionSymbols.StorageService) storageService: StorageService<MessageIdRecord>,
    eventEmitter: EventEmitter
  ) {
    super(MessageIdRecord, storageService, eventEmitter)
  }
}
