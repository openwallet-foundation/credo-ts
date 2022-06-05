import { inject, scoped, Lifecycle } from 'tsyringe'

import { InjectionSymbols } from '../../../constants'
import { Repository } from '../../../storage/Repository'
import { StorageService } from '../../../storage/StorageService'

import { QuestionAnswerRecord } from './QuestionAnswerRecord'

@scoped(Lifecycle.ContainerScoped)
export class QuestionAnswerRepository extends Repository<QuestionAnswerRecord> {
  public constructor(@inject(InjectionSymbols.StorageService) storageService: StorageService<QuestionAnswerRecord>) {
    super(QuestionAnswerRecord, storageService)
  }
}
