import { EventEmitter } from '../../../agent/EventEmitter'
import { InjectionSymbols } from '../../../constants'
import { inject, injectable } from '../../../plugins'
import { Repository } from '../../../storage/Repository'
import { StorageService } from '../../../storage/StorageService'

import { QuestionAnswerRecord } from './QuestionAnswerRecord'

@injectable()
export class QuestionAnswerRepository extends Repository<QuestionAnswerRecord> {
  public constructor(
    @inject(InjectionSymbols.StorageService) storageService: StorageService<QuestionAnswerRecord>,
    eventEmitter: EventEmitter
  ) {
    super(QuestionAnswerRecord, storageService, eventEmitter)
  }
}
