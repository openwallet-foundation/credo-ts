import type { QuestionAnswerState } from './models'
import type { QuestionAnswerRecord } from './repository'
import type { BaseEvent } from '@aries-framework/core'

export enum QuestionAnswerEventTypes {
  QuestionAnswerStateChanged = 'QuestionAnswerStateChanged',
}
export interface QuestionAnswerStateChangedEvent extends BaseEvent {
  type: typeof QuestionAnswerEventTypes.QuestionAnswerStateChanged
  payload: {
    previousState: QuestionAnswerState | null
    questionAnswerRecord: QuestionAnswerRecord
  }
}
