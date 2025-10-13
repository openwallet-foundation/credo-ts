import type { Agent } from '@credo-ts/core'
import type {
  QuestionAnswerRole,
  QuestionAnswerState,
  QuestionAnswerStateChangedEvent,
} from '@credo-ts/question-answer'
import { QuestionAnswerEventTypes } from '@credo-ts/question-answer'
import type { Observable } from 'rxjs'
import { catchError, filter, map, ReplaySubject, timeout } from 'rxjs'
import { firstValueWithStackTrace } from '../../core/tests/helpers'

export async function waitForQuestionAnswerRecord(
  agent: Agent,
  options: {
    threadId?: string
    role?: QuestionAnswerRole
    state?: QuestionAnswerState
    previousState?: QuestionAnswerState | null
    timeoutMs?: number
  }
) {
  const observable = agent.events.observable<QuestionAnswerStateChangedEvent>(
    QuestionAnswerEventTypes.QuestionAnswerStateChanged
  )

  return waitForQuestionAnswerRecordSubject(observable, options)
}

export function waitForQuestionAnswerRecordSubject(
  subject: ReplaySubject<QuestionAnswerStateChangedEvent> | Observable<QuestionAnswerStateChangedEvent>,
  {
    threadId,
    role,
    state,
    previousState,
    timeoutMs = 10000,
  }: {
    threadId?: string
    role?: QuestionAnswerRole
    state?: QuestionAnswerState
    previousState?: QuestionAnswerState | null
    timeoutMs?: number
  }
) {
  const observable = subject instanceof ReplaySubject ? subject.asObservable() : subject
  return firstValueWithStackTrace(
    observable.pipe(
      filter((e) => previousState === undefined || e.payload.previousState === previousState),
      filter((e) => threadId === undefined || e.payload.questionAnswerRecord.threadId === threadId),
      filter((e) => role === undefined || e.payload.questionAnswerRecord.role === role),
      filter((e) => state === undefined || e.payload.questionAnswerRecord.state === state),
      timeout(timeoutMs),
      catchError(() => {
        throw new Error(
          `QuestionAnswerChangedEvent event not emitted within specified timeout: {
    previousState: ${previousState},
    threadId: ${threadId},
    state: ${state}
  }`
        )
      }),
      map((e) => e.payload.questionAnswerRecord)
    )
  )
}
