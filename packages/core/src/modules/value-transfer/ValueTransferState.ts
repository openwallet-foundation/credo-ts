/**
 * Value Transfer protocol states
 *
 * */
export enum ValueTransferState {
  RequestSent = 'request-sent',
  RequestReceived = 'request-received',

  RequestAcceptanceSent = 'request-acceptance-sent',
  RequestAcceptanceReceived = 'request-acceptance-received',

  CashAcceptanceSent = 'cash-acceptance-sent',
  CashAcceptanceReceived = 'cash-acceptance-received',

  CashRemovalSent = 'cash-removal-sent',
  CashRemovalReceived = 'cash-removal-received',

  ReceiptSent = 'receipt-sent',

  Failed = 'failed',
  Completed = 'completed',
}
