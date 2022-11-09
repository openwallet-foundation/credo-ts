/**
 * QuestionAnswer states inferred from RFC 0113.
 *
 * @see https://github.com/hyperledger/aries-rfcs/blob/main/features/0113-question-answer/README.md
 */
export enum QuestionAnswerState {
  QuestionSent = 'question-sent',
  QuestionReceived = 'question-received',
  AnswerReceived = 'answer-received',
  AnswerSent = 'answer-sent',
}
