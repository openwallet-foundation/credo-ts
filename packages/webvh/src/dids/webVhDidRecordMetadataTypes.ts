import type { DIDResolutionMeta, WitnessProofFileEntry } from 'didwebvh-ts'
import type { WebVhDidLog } from '../resources'

export type WebVhUpdateKeyKmsKeyIds = Record<string, string>

export enum WebVhDidRecordMetadataKeys {
  // FIXME: refactor to '_internal/webvhDidLog' in next major release
  DidLog = 'log',
  UpdateKeyKmsKeyIds = '_internal/webvhUpdateKeyKmsKeyIds',
  ControllerMetadata = '_internal/webvhControllerMetadata',
  WitnessProofs = '_internal/webvhWitnessProofs',
}

export type WebVhDidRecordMetadata = {
  [WebVhDidRecordMetadataKeys.DidLog]: WebVhDidLog
  [WebVhDidRecordMetadataKeys.UpdateKeyKmsKeyIds]: WebVhUpdateKeyKmsKeyIds
  [WebVhDidRecordMetadataKeys.ControllerMetadata]: DIDResolutionMeta
  [WebVhDidRecordMetadataKeys.WitnessProofs]: WitnessProofFileEntry[]
}
