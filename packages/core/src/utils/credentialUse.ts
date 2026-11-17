import { AgentContext } from '../agent'
import { CredoError } from '../error/CredoError'
import { Mdoc } from '../modules/mdoc/Mdoc'
import { MdocRecord, type MdocRecordInstances, MdocRepository } from '../modules/mdoc/repository'
import { decodeSdJwtVc } from '../modules/sd-jwt-vc/decodeSdJwtVc'
import { SdJwtVcRecord, type SdJwtVcRecordInstances, SdJwtVcRepository } from '../modules/sd-jwt-vc/repository'
import type { SdJwtVc } from '../modules/sd-jwt-vc/SdJwtVcService'
import { getStoredHolderKmsKeyId } from '../modules/sd-jwt-vc/utils'
import {
  W3cJsonLdVerifiableCredential,
  W3cJwtVerifiableCredential,
  type W3cV2VerifiableCredential,
  type W3cVerifiableCredential,
} from '../modules/vc'
import { decodeW3cV2VerifiableCredential } from '../modules/vc/models/credential/W3cV2VerifiableCredential'
import {
  W3cCredentialRecord,
  type W3cCredentialRecordInstances,
  W3cCredentialRepository,
  W3cV2CredentialRecord,
  type W3cV2CredentialRecordInstances,
  W3cV2CredentialRepository,
} from '../modules/vc/repository'
import {
  CredentialMultiInstanceState,
  CredentialMultiInstanceUseMode,
  CredentialMultiInstanceUseUpdateMode,
} from './credentialUseTypes'

export { CredentialMultiInstanceState, CredentialMultiInstanceUseMode, CredentialMultiInstanceUseUpdateMode }

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
 * Checks whether an instance can be used from the provided record based on
 * the required credential use mode.
 */
export function canUseInstanceFromCredentialRecord({
  credentialRecord,
  useMode,
}: {
  credentialRecord: CredentialRecord
  useMode: CredentialMultiInstanceUseMode
}) {
  // If we're not required to use a new instance, we can always return the first instance
  if (
    useMode === CredentialMultiInstanceUseMode.First ||
    useMode === CredentialMultiInstanceUseMode.NewOrFirst ||
    (useMode === CredentialMultiInstanceUseMode.NewIfReceivedInBatch &&
      [CredentialMultiInstanceState.SingleInstanceUnused, CredentialMultiInstanceState.SingleInstanceUsed].includes(
        credentialRecord.multiInstanceState
      ))
  ) {
    return true
  }

  // Otherwise we return whether we can use a new instance
  return credentialRecord.credentialInstances.some((_, index) => isInstanceUnused(credentialRecord, index))
}

function isInstanceUnused(credentialRecord: CredentialRecord, index: number) {
  // Records stored before `usageCount` only track the use of the first instance in `multiInstanceState`
  if (index === 0) {
    return (
      credentialRecord.multiInstanceState === CredentialMultiInstanceState.MultiInstanceFirstUnused ||
      credentialRecord.multiInstanceState === CredentialMultiInstanceState.SingleInstanceUnused
    )
  }

  return !credentialRecord.credentialInstances[index].usageCount
}

export interface UseInstanceFromCredentialRecordOptions<Record extends CredentialRecord> {
  agentContext: AgentContext

  /**
   * Which mode to use for usage of the credential instance. See {@link CredentialMultiInstanceUseMode} for
   * more information on the available options
   */
  useMode: CredentialMultiInstanceUseMode
  credentialRecord: Record

  /**
   * The update mode for the credential record, which stores the usage count of the instance.
   *
   * @default `CredentialMultiInstanceUseUpdateMode.RefetchAndUpdateWithLock`
   */
  updateMode?: CredentialMultiInstanceUseUpdateMode
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
   * The last new instance is the first entry in the instances, since it is reserved
   * for 'reused' usage.
   */
  isLastNewInstance: boolean
}

/**
 * Extract an instance with the correct kms key id from the credential instances
 * on the record, and increase its `usageCount`. Used instances stay on the record.
 *
 * If the method indicates the last new instance has been used, you should remove the
 * credential from storage if you don't want it to be used anymore in the future.
 */
export async function useInstanceFromCredentialRecord<Record extends CredentialRecord>({
  credentialRecord,
  useMode,
  agentContext,
  updateMode = CredentialMultiInstanceUseUpdateMode.RefetchAndUpdateWithLock,
}: UseInstanceFromCredentialRecordOptions<Record>): Promise<UseInstanceFromCredentialRecordReturn<Record>> {
  let extractResult = extractInstanceAndUpdateRecord({
    credentialRecord,
    useMode,
  })

  if (updateMode === CredentialMultiInstanceUseUpdateMode.Update) {
    await updateCredentialRecord(agentContext, credentialRecord)
  }

  if (updateMode === CredentialMultiInstanceUseUpdateMode.RefetchAndUpdateWithLock) {
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
    const { issuerSignedBase64Url, kmsKeyId, kmsBackend } = extractResult.credentialInstance as MdocRecordInstances[0]
    transformedCredentialInstance = Mdoc.fromBase64Url(issuerSignedBase64Url)
    transformedCredentialInstance.deviceKeyId = kmsKeyId ?? transformedCredentialInstance.deviceKey.legacyKeyId
    transformedCredentialInstance.deviceKmsBackend = kmsBackend
  } else if (credentialRecord instanceof SdJwtVcRecord) {
    const { compactSdJwtVc, kmsKeyId, kmsBackend } = extractResult.credentialInstance as SdJwtVcRecordInstances[0]

    const sdJwtVc = decodeSdJwtVc(compactSdJwtVc, credentialRecord.typeMetadata)
    transformedCredentialInstance = {
      ...sdJwtVc,
      kmsKeyId: getStoredHolderKmsKeyId(sdJwtVc.holder, kmsKeyId),
      kmsBackend,
    }
  } else if (credentialRecord instanceof W3cCredentialRecord) {
    const { credential } = extractResult.credentialInstance as W3cCredentialRecordInstances[0]

    transformedCredentialInstance =
      typeof credential === 'string'
        ? W3cJwtVerifiableCredential.fromSerializedJwt(credential)
        : W3cJsonLdVerifiableCredential.fromJson(credential)
  } else if (credentialRecord instanceof W3cV2CredentialRecord) {
    const { credential } = extractResult.credentialInstance as W3cV2CredentialRecordInstances[0]

    transformedCredentialInstance = decodeW3cV2VerifiableCredential(credential)
  } else {
    throw new CredoError('Unsupported record type')
  }

  return {
    credentialInstance: transformedCredentialInstance as CredentialInstanceReturnType<Record>,
    isReused: extractResult.isReused,
    isLastNewInstance: extractResult.isLastNewInstance,
  }
}

function extractInstanceAndUpdateRecord<Record extends CredentialRecord>({
  credentialRecord,
  useMode,
}: Pick<UseInstanceFromCredentialRecordOptions<Record>, 'credentialRecord' | 'useMode'>) {
  const { credentialInstances } = credentialRecord

  // The first instance is reserved for reuse, so the other instances are used first, starting from the last one
  let newInstanceIndex = -1
  if (useMode !== CredentialMultiInstanceUseMode.First) {
    for (let index = credentialInstances.length - 1; index > 0; index--) {
      if (isInstanceUnused(credentialRecord, index)) {
        newInstanceIndex = index
        break
      }
    }
  }

  if (newInstanceIndex === -1) {
    const isFirstUnused = isInstanceUnused(credentialRecord, 0)

    const isMultiInstance =
      credentialRecord.multiInstanceState === CredentialMultiInstanceState.MultiInstanceFirstUnused ||
      credentialRecord.multiInstanceState === CredentialMultiInstanceState.MultiInstanceFirstUsed

    const allowsReuse =
      // New does not allow reuse
      useMode === CredentialMultiInstanceUseMode.New
        ? false
        : // NewIfReceivedInBatch only allows reuse if the credential was not multi instance
          useMode === CredentialMultiInstanceUseMode.NewIfReceivedInBatch
          ? !isMultiInstance
          : // Otherwise we allow reuse (First or NewOrFirst)
            true

    if (isFirstUnused) {
      credentialRecord.multiInstanceState =
        credentialRecord.multiInstanceState === CredentialMultiInstanceState.SingleInstanceUnused
          ? CredentialMultiInstanceState.SingleInstanceUsed
          : CredentialMultiInstanceState.MultiInstanceFirstUsed
    } else if (!allowsReuse) {
      throw new CredoError(
        `Unable to extract new credential instance from ${credentialRecord.type} with id '${credentialRecord.id}', since it only contains a single credential instance but using a new instance is required due to use mode '${useMode}'.`
      )
    }

    const credentialInstance = credentialInstances[0]
    credentialInstance.usageCount = (credentialInstance.usageCount ?? 0) + 1

    return {
      isReused: !isFirstUnused,
      credentialInstance,
      isLastNewInstance: isFirstUnused,
    }
  }

  const credentialInstance = credentialInstances[newInstanceIndex]
  credentialInstance.usageCount = 1

  return {
    credentialInstance,
    isReused: false,
    isLastNewInstance: false,
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
