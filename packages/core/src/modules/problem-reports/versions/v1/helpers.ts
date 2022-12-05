import type { PlaintextDidCommV1Message } from '../../../../didcomm'

import { ProblemReportReason } from '../../models/ProblemReportReason'

import { ProblemReportMessage } from './messages'

/**
 * Build the v1 problem report message to the recipient.
 * @param plaintextMessage received inbound message
 * @param errorMessage error message to send
 */
export const buildProblemReportV1Message = (
  onMessage: PlaintextDidCommV1Message,
  errorMessage: string
): ProblemReportMessage | undefined => {
  const problemReportMessage = new ProblemReportMessage({
    description: {
      en: errorMessage,
      code: ProblemReportReason.MessageParseFailure,
    },
  })
  problemReportMessage.setThread({
    threadId: onMessage['@id'],
  })
  return problemReportMessage
}
