import type { Kms } from '@credo-ts/core'
import type { WebVhDidLog } from '../resources'

export enum WebVhDidRecordMetadataKeys {
  // FIXME: refactor to '_internal/webvhDidLog' in next major release
  DidLog = 'log',
  UpdateKeyKmsKeyIds = '_internal/webvhUpdateKeyKmsKeyIds',
}

export type WebVhDidRecordMetadata = {
  [WebVhDidRecordMetadataKeys.DidLog]: WebVhDidLog
  // Records created before the backend was stored hold only the key id
  [WebVhDidRecordMetadataKeys.UpdateKeyKmsKeyIds]: Record<string, string | Kms.KmsKeyReference>
}
