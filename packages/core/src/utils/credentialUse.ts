// TODO: we should probably move this to another file
// and create a set of abstract credential utils that
// can work with any credential record/type. For now
// this works okay since we don't add new credential
// types often.

import { AgentContext } from '../agent'
import { CredoError } from '../error'
import { Mdoc, MdocRecord, type MdocRecordInstances, MdocRepository } from '../modules/mdoc'
import { type SdJwtVc, SdJwtVcRecord, type SdJwtVcRecordInstances, SdJwtVcRepository } from '../modules/sd-jwt-vc'
import { decodeSdJwtVc } from '../modules/sd-jwt-vc/decodeSdJwtVc'
import {
  W3cCredentialRecord,
  type W3cCredentialRecordInstances,
  W3cCredentialRepository,
  W3cJsonLdVerifiableCredential,
  W3cJwtVerifiableCredential,
  W3cV2CredentialRecord,
  type W3cV2CredentialRecordInstances,
  W3cV2CredentialRepository,
  W3cV2JwtVerifiableCredential,
  W3cV2SdJwtVerifiableCredential,
  type W3cV2VerifiableCredential,
  type W3cVerifiableCredential,
} from '../modules/vc'

type CredentialRecord = W3cCredentialRecord | SdJwtVcRecord | MdocRecord | W3cV2CredentialRecord

type CredentialInstanceReturnType<Record extends CredentialRecord> = Record extends W3cCredentialRecord
  ? W3cVerifiableCredential
  : Record extends W3cV2CredentialRecord
    ? W3cV2VerifiableCredential
    : Record extends SdJwtVcRecord
      ? SdJwtVc
      : Record extends MdocRecord
        ? Mdoc
        : CredentialRecord

type CredentialRepositoryForRecord<Record extends CredentialRecord> = Record extends W3cCredentialRecord
  ? W3cCredentialRepository
  : Record extends W3cV2CredentialRepository
    ? W3cV2VerifiableCredential
    : Record extends SdJwtVcRepository
      ? SdJwtVc
      : Record extends MdocRepository
        ? Mdoc
        : W3cCredentialRepository | W3cV2CredentialRepository | SdJwtVcRepository | MdocRepository

/**
 * The `CredentialUseMode` enum offers different modes for usage of credential instances from records.
 */
export enum CredentialUseMode {
  /**
   * Always use a new unused instance. If not available an error will be thrown
   * that a new instance could not be extracted. This removes the instance from the record.
   */
  New = 'New',

  /**
   * Use a new unused instance if the credential was received as a batch (mimicking behavior of the `CredentialUseMode.New` mode).
   * If only a single instance was received it will use the first instance (mimicking behavior of the `CredentialUseMode.First` mode).
   */
  NewIfReceivedInBatch = 'NewIfReceivedInBatch',

  /**
   * use a new unused instance if available, or fallback to the
   * first one if not available. This is a combination of the `first` and `new` modes, and the same
   * behavior applies (in terms of whether the instance is removed from the record).
   */
  NewOrFirst = 'NewOrFirst',

  /**
   * Always use the first credential instance on the record. This does not remove
   * the credential instance from the record, and it also does not prevent reusing.
   */
  First = 'First',
}

export enum CredentialUseUpdateMode {
  /**
   * The record is not updated, which means the credential can be reused in the future even
   * if `useMode` is set to `New`. This is generally not recommended.
   */
  None = 'None',

  /**
   * Update the provided record if a new instance is used. This may result in race conditions
   * if multiple processes are using the record at the same time (e.g. in a server environment)
   */
  Update = 'Update',

  /**
   * Refetch and update the provided record with a lock. This is the safest method, but does
   * require another re-fetch of the record. Locking is not supported on all databases backend,
   * in which case the record will be refetched and updated without lock.
   *
   * Even without lock, this will still minimize the chance of race conditions and concurrent writes significantly, as
   * with the standard `Update` the record was fetched at the time the credentials were received, which is usually before
   * showing the request to the user and waiting for confirmation.
   *
   * This is the recommended option.
   */
  RefetchAndUpdateWithLock = 'RefetchAndUpdateWithLock',
}

/**
 * Checks whether an instance can be used from the provided record based on
 * the required credential use mode.
 */
export function canUseInstanceFromCredentialRecord({
  credentialRecord,
  useMode,
}: {
  credentialRecord: CredentialRecord
  useMode: CredentialUseMode
}) {
  // If we're not required to use a new instance, we can always return the first instance
  if (
    useMode === CredentialUseMode.First ||
    useMode === CredentialUseMode.NewOrFirst ||
    (useMode === CredentialUseMode.NewIfReceivedInBatch && !credentialRecord.isMultiInstanceRecord)
  ) {
    return true
  }

  // Otherwise we return whether we can use a new instance
  const canUseNewInstance = credentialRecord.credentialInstances.length >= 2
  return canUseNewInstance
}

export interface UseInstanceFromCredentialRecordOptions<Record extends CredentialRecord> {
  agentContext: AgentContext

  /**
   * Which mode to use for usage of the credential instance. See {@link CredentialUseMode} for
   * more information on the available options
   */
  useMode: CredentialUseMode
  credentialRecord: Record

  /**
   * The update mode for the credential record when a new instance is used.
   *
   * @default `CredentialUseUpdateMode.RefetchAndUpdateWithLock`
   */
  updateMode?: CredentialUseUpdateMode
}

export interface UseInstanceFromCredentialRecordReturn<Record extends CredentialRecord> {
  /**
   * The credential instance with the kms key id
   */
  credentialInstance: CredentialInstanceReturnType<Record>

  /**
   * If the first instance was used, this value will be `true`. The first time
   * the first instance is used, technically the credential is not reused yet,
   * but we make no distinction between this.
   */
  isReused: boolean

  /**
   * Whether the last new instance was used. If `isReused` is `true` this value will
   * always be `false`.
   *
   * The last new instance is the second entry in the mdoc instances, since the first
   * one is reserved for 'reused' usage.
   */
  isLastNewInstance: boolean
}

/**
 * Extract an instance with the correct kms key id from the credential instances
 * on the record. Note that if an instance is extracted (that is not reused) it
 * will remove the instance from the record, and the record should be updated in
 * storage after usage.
 *
 * Note that the last credential instance is never removed from the record. So if the
 * method indicates the last instance has been used, you should remove the credential
 * from storage if you don't want it to be used anymore in the future.
 */
export async function useInstanceFromCredentialRecord<Record extends CredentialRecord>({
  credentialRecord,
  useMode,
  agentContext,
  updateMode,
}: UseInstanceFromCredentialRecordOptions<Record>): Promise<UseInstanceFromCredentialRecordReturn<Record>> {
  let extractResult = extractInstanceAndUpdateRecord({
    credentialRecord,
    useMode,
  })

  if (!extractResult.isReused && updateMode === CredentialUseUpdateMode.Update) {
    await updateCredentialRecord(agentContext, credentialRecord)
  }

  if (!extractResult.isReused && updateMode === CredentialUseUpdateMode.RefetchAndUpdateWithLock) {
    // the method is generic, but the types don't work well generically
    const repository = repositoryForRecord(agentContext, credentialRecord) as SdJwtVcRepository

    await repository.updateByIdWithLock(
      agentContext,
      credentialRecord.id,
      async (freshCredentialRecord: SdJwtVcRecord) => {
        extractResult = extractInstanceAndUpdateRecord({
          credentialRecord: freshCredentialRecord,
          useMode,
        })

        return freshCredentialRecord
      }
    )
  }

  let transformedCredentialInstance: W3cVerifiableCredential | Mdoc | SdJwtVc | W3cV2VerifiableCredential
  if (credentialRecord instanceof MdocRecord) {
    const { issuerSignedBase64Url, kmsKeyId } = extractResult.credentialInstance as MdocRecordInstances[0]
    transformedCredentialInstance = Mdoc.fromBase64Url(issuerSignedBase64Url)
    transformedCredentialInstance.deviceKeyId = kmsKeyId ?? transformedCredentialInstance.deviceKey.legacyKeyId
  } else if (credentialRecord instanceof SdJwtVcRecord) {
    const { compactSdJwtVc, kmsKeyId } = extractResult.credentialInstance as SdJwtVcRecordInstances[0]

    transformedCredentialInstance = {
      ...decodeSdJwtVc(compactSdJwtVc, credentialRecord.typeMetadata),
      kmsKeyId,
    }
  } else if (credentialRecord instanceof W3cCredentialRecord) {
    const { credential } = extractResult.credentialInstance as W3cCredentialRecordInstances[0]

    transformedCredentialInstance =
      typeof credential === 'string'
        ? W3cJwtVerifiableCredential.fromSerializedJwt(credential)
        : W3cJsonLdVerifiableCredential.fromJson(credential)
  } else if (credentialRecord instanceof W3cV2CredentialRecord) {
    const { credential } = extractResult.credentialInstance as W3cV2CredentialRecordInstances[0]

    transformedCredentialInstance = credential.includes('~')
      ? W3cV2SdJwtVerifiableCredential.fromCompact(credential)
      : W3cV2JwtVerifiableCredential.fromCompact(credential)
  } else {
    throw new CredoError('Unsupported record type')
  }

  return {
    credentialInstance: transformedCredentialInstance as CredentialInstanceReturnType<Record>,
    isReused: extractResult.isReused,
    isLastNewInstance: extractResult.isLastNewInstance,
  }
}

export function extractInstanceAndUpdateRecord<Record extends CredentialRecord>({
  credentialRecord,
  useMode,
}: Pick<UseInstanceFromCredentialRecordOptions<Record>, 'credentialRecord' | 'useMode'>) {
  let credentialInstance: (typeof credentialRecord)['credentialInstances'][0]
  let isReused: boolean

  if (credentialRecord.credentialInstances.length === 1 || useMode === CredentialUseMode.First) {
    if (
      useMode === CredentialUseMode.New ||
      (useMode === CredentialUseMode.NewIfReceivedInBatch && credentialRecord.isMultiInstanceRecord)
    ) {
      // TODO: custom error
      throw new CredoError(
        `Unable to extract new credential instance from ${credentialRecord.type} with id '${credentialRecord.id}', since it only contains a single credential instance but using a new instance is required.`
      )
    }

    credentialInstance = credentialRecord.credentialInstances[0]
    isReused = true
  } else {
    const _credentialInstance = credentialRecord.credentialInstances.pop()
    if (!_credentialInstance) {
      throw new CredoError(
        `Unable to extract credential instance from ${credentialRecord.type} with id '${credentialRecord.id}', since the credential record does not contain any credential instances.`
      )
    }

    credentialInstance = _credentialInstance
    isReused = false
  }

  return {
    credentialInstance,
    isReused,
    isLastNewInstance: credentialRecord.credentialInstances.length === 1 && !isReused,
  }
}

function repositoryForRecord<Record extends CredentialRecord>(
  agentContext: AgentContext,
  record: CredentialRecord
): CredentialRepositoryForRecord<Record> {
  if (record instanceof W3cCredentialRecord)
    return agentContext.resolve(W3cCredentialRepository) as CredentialRepositoryForRecord<Record>
  if (record instanceof W3cV2CredentialRecord)
    return agentContext.resolve(W3cV2CredentialRepository) as CredentialRepositoryForRecord<Record>
  if (record instanceof MdocRecord) return agentContext.resolve(MdocRepository) as CredentialRepositoryForRecord<Record>
  return agentContext.resolve(SdJwtVcRepository) as CredentialRepositoryForRecord<Record>
}

function updateCredentialRecord(agentContext: AgentContext, record: CredentialRecord) {
  if (record instanceof W3cCredentialRecord)
    return agentContext.resolve(W3cCredentialRepository).update(agentContext, record)
  if (record instanceof W3cV2CredentialRecord)
    return agentContext.resolve(W3cV2CredentialRepository).update(agentContext, record)
  if (record instanceof MdocRecord) return agentContext.resolve(MdocRepository).update(agentContext, record)
  return agentContext.resolve(SdJwtVcRepository).update(agentContext, record)
}
