/**
 * Value Transfer protocol states
 *
 * */
export enum ValueTransferState {
  RequestSent = 'request-sent',
  OfferSent = 'offer-sent',
  OfferAcceptanceSent = 'offer-acceptance-sent',
  OfferAcceptanceReceived = 'offer-acceptance-received',
  RequestReceived = 'request-received',
  OfferReceived = 'offer-received',
  RequestAcceptanceSent = 'request-acceptance-sent',
  RequestAcceptanceReceived = 'request-acceptance-received',
  CashAcceptanceSent = 'cash-acceptance-sent',
  CashAcceptanceReceived = 'cash-acceptance-received',
  CashSignatureSent = 'cash-signature-sent',
  CashSignatureReceived = 'cash-signature-received',
  WaitingReceipt = 'waiting-receipt',
  ReceiptReceived = 'receipt-received',
  Failed = 'failed',
  Completed = 'completed',
  Paused = 'paused',
}
