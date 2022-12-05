import type { PlaintextDidCommV2Message } from '../../../../didcomm'

import { ProblemReportReason } from '../../models/ProblemReportReason'

import { ProblemReportMessage } from './messages'

/**
 * Build the v2 problem report message to the recipient.
 * @param plaintextMessage received inbound message
 * @param errorMessage error message to send
 */
export const buildProblemReportV2Message = (
  plaintextMessage: PlaintextDidCommV2Message,
  errorMessage: string
): ProblemReportMessage | undefined => {
  // Cannot send problem report for message with unknown sender or recipient
  if (!plaintextMessage.from || !plaintextMessage.to?.length) return

  return new ProblemReportMessage({
    parentThreadId: plaintextMessage.id,
    from: plaintextMessage.to.length ? plaintextMessage.to[0] : undefined,
    to: plaintextMessage.from,
    body: {
      code: ProblemReportReason.MessageParseFailure,
      comment: errorMessage,
    },
  })
}
