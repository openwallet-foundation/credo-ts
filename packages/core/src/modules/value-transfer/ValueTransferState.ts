/**
 * Value Transfer protocol states
 *
 * */
export enum ValueTransferState {
  RequestSent = 'request-sent',
  RequestReceived = 'request-received',
  RequestAcceptanceSent = 'request-acceptance-sent',
  CashAcceptanceSent = 'cash-acceptance-sent',
  CashSignatureSent = 'cash-signature-sent',
  WaitingReceipt = 'waiting-receipt',
  Failed = 'failed',
  Completed = 'completed',
}
