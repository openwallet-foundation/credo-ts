export interface SendRevocationNotificationOptions {
  connectionId?: string
  credentialExchangeRecordId?: string
  revocationId: string
  revocationFormat: string
  comment?: string
  requestAck?: boolean
}
