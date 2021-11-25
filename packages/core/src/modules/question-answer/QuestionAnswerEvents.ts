import type { BaseEvent } from '../../agent/Events'
import type { QuestionAnswerRecord } from './repository'
import type { QuestionAnswerState } from './models'

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