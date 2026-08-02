import type { WebVhDidLog } from '../resources'

export enum WebVhDidRecordMetadataKeys {
  // FIXME: refactor to '_internal/webvhDidLog' in next major release
  DidLog = 'log',
  UpdateKeyKmsKeyIds = '_internal/webvhUpdateKeyKmsKeyIds',
}

export type WebVhDidRecordMetadata = {
  [WebVhDidRecordMetadataKeys.DidLog]: WebVhDidLog
  [WebVhDidRecordMetadataKeys.UpdateKeyKmsKeyIds]: Record<string, string>
}
