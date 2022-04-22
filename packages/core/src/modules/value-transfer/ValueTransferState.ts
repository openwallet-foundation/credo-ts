/**
 * Value Transfer protocol states
 *
 * https://github.com/sicpa-dlab/cbdc-design/tree/main/protocols/value-transfer-protocol-1.0#states
 * */
export enum ValueTransferState {
  MyTxn = 'my-txn',
  TheirTxn = 'their-txn',
  Agreed = 'agreed',
  CancelPending = 'cancel-pend',
}
