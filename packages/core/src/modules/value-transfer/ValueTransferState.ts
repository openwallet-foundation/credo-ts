/**
 * Value Transfer protocol states
 *
 * */
export enum ValueTransferState {
  RequestSent = 'request-sent',
  OfferSent = 'offe-sent',
  OfferAcceptanceSent = 'offer-acceptance-sent',
  RequestReceived = 'request-received',
  OfferReceived = 'offer-received',
  RequestAcceptanceSent = 'request-acceptance-sent',
  CashAcceptanceSent = 'cash-acceptance-sent',
  CashSignatureSent = 'cash-signature-sent',
  WaitingReceipt = 'waiting-receipt',
  ReceiptReceived = 'receipt-received',
  Failed = 'failed',
  Completed = 'completed',
}
