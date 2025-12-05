// reflect-metadata used for class-transformer + class-validator
import 'reflect-metadata'

export * from './agent'
export { Agent } from './agent/Agent'
export { AgentConfig } from './agent/AgentConfig'
export type { AgentDependencies } from './agent/AgentDependencies'
export type { AgentApi, DefaultAgentModules, EmptyModuleMap, ModulesMap } from './agent/AgentModules'
export { BaseAgent } from './agent/BaseAgent'
export { EventEmitter } from './agent/EventEmitter'
export * from './agent/Events'
export { InjectionSymbols } from './constants'
export * from './crypto'
export * from './error'
export * from './logger'
export * from './modules/cache'
export * from './modules/dcql'
export * from './modules/dids'
export { tryParseDid } from './modules/dids/domain/parse'
// TODO: Clean up these exports used by DIDComm module
export {
  didKeyToEd25519PublicJwk,
  didKeyToVerkey,
  isDidKey,
  verkeyToDidKey,
  verkeyToPublicJwk,
} from './modules/dids/helpers'
export { didDocumentJsonToNumAlgo1Did } from './modules/dids/methods/peer/peerDidNumAlgo1'
export { didDocumentToNumAlgo2Did } from './modules/dids/methods/peer/peerDidNumAlgo2'
export { didDocumentToNumAlgo4Did } from './modules/dids/methods/peer/peerDidNumAlgo4'
export { DidRecordMetadataKeys } from './modules/dids/repository/didRecordMetadataTypes'
export * from './modules/dif-presentation-exchange'
export * from './modules/generic-records'
export * as Kms from './modules/kms'
export * from './modules/mdoc'
export * from './modules/sd-jwt-vc'
export * from './modules/vc'
export * from './modules/x509'
export * from './plugins'
export * from './storage/BaseRecord'
export type { DownloadToFileOptions, FileSystem } from './storage/FileSystem'
export { Metadata, type MetadataBase } from './storage/Metadata'
export * from './storage/migration'
export type { UpdateConfig, V0_1ToV0_2UpdateConfig } from './storage/migration/updates'
export { Repository } from './storage/Repository'
export * from './storage/RepositoryEvents'
export type { BaseRecordConstructor, Query, QueryOptions, SimpleQuery, StorageService } from './storage/StorageService'
export type {
  AnyUint8Array,
  CanBePromise,
  InitConfig,
  JsonArray,
  JsonObject,
  JsonValue,
  NonEmptyArray,
  Optional,
  ResolvedDidCommService,
  SingleOrArray,
  Uint8ArrayBuffer,
  XOR,
} from './types'
export { isJsonObject, isNonEmptyArray, mapNonEmptyArray } from './types'
export {
  asArray,
  type BaseName,
  Buffer,
  DateTransformer,
  deepEquality,
  equalsIgnoreOrder,
  equalsWithOrder,
  IsStringOrInstance,
  IsStringOrInstanceOrArrayOfInstances,
  IsStringOrStringArray,
  IsUri,
  isDid,
  JsonEncoder,
  JsonTransformer,
  MessageValidator,
  MultiBaseEncoder,
  MultiHashEncoder,
  TypedArrayEncoder,
} from './utils'
export { base64ToBase64URL } from './utils/base64'
export type {
  CredentialMultiInstanceUseUpdateMode,
  UseInstanceFromCredentialRecordOptions,
  UseInstanceFromCredentialRecordReturn,
} from './utils/credentialUse'
export { canUseInstanceFromCredentialRecord, useInstanceFromCredentialRecord } from './utils/credentialUse'
export { CredentialMultiInstanceState, CredentialMultiInstanceUseMode } from './utils/credentialUseTypes'
export { getDomainFromUrl } from './utils/domain'
export type { Constructable, Constructor, UnionToIntersection } from './utils/mixins'
export { getDirFromFilePath, joinUriParts } from './utils/path'
export type { VersionString } from './utils/version'

import { indyDidFromPublicKeyBase58 } from './utils/did'
import { areObjectsEqual } from './utils/objectEquality'
import timestamp, { addSecondsToDate, dateToSeconds, nowInSeconds } from './utils/timestamp'
import { getProtocolScheme } from './utils/uri'
import { isValidUuid, uuid } from './utils/uuid'

const utils = {
  areObjectsEqual,
  uuid,
  isValidUuid,
  getProtocolScheme,
  timestamp,
  indyDidFromPublicKeyBase58,
  nowInSeconds,
  dateToSeconds,
  addSecondsToDate,
}

export { utils }
