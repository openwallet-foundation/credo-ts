// TODO: we should probably move this to another file
// and create a set of abstract credential utils that
// can work with any credential record/type

import { AgentContext } from '../agent'
import { CredoError } from '../error'
import { Mdoc, MdocRecord, MdocRecordInstances, MdocRepository } from '../modules/mdoc'
import { SdJwtVc, SdJwtVcRecord, SdJwtVcRecordInstances, SdJwtVcRepository } from '../modules/sd-jwt-vc'
import { decodeSdJwtVc } from '../modules/sd-jwt-vc/decodeSdJwtVc'
import {
  W3cCredentialRecord,
  W3cCredentialRecordInstances,
  W3cCredentialRepository,
  W3cJsonLdVerifiableCredential,
  W3cJwtVerifiableCredential,
  W3cVerifiableCredential,
} from '../modules/vc'

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
   * Use a new unused instance if the credential was received as a batch (mimicking behaviour of the `CredentialUseMode.New` mode).
   * If only a single instance was received it will use the first instance (mimicking behaviour of the `CredentialUseMode.First` mode).
   */
  NewIfReceivedInBatch = 'NewIfReceivedInBatch',

  /**
   * use a new unused instance if available, or fallback to the
   * first one if not available. This is a combination of the `first` and `new` modes, and the same
   * behaviour applies (in terms of whether the instance is removed from the record).
   */
  NewOrFirst = 'NewOrFirst',

  /**
   * Always use the first credential instance on the record. This does not remove
   * the credential instance from the record, and it also does not prevent reusage.
   */
  First = 'First',
}

/**
 * Checks whether an instance can be used from the provided record based on
 * the required credential use mode.
 */
export function canUseInstanceFromCredentialRecord({
  credentialRecord,
  useMode,
}: {
  credentialRecord: W3cCredentialRecord | SdJwtVcRecord | MdocRecord
  useMode: CredentialUseMode
}) {
  // If we're not required to use a new instance, we can always return the first instance
  if (
    useMode === CredentialUseMode.First ||
    useMode === CredentialUseMode.NewOrFirst ||
    (useMode === CredentialUseMode.NewIfReceivedInBatch && !credentialRecord.credentialInstances)
  ) {
    return true
  }

  // Otherwise we return whether we can use a new instance
  const canUseNewInstance = credentialRecord.credentialInstances.length >= 2
  return canUseNewInstance
}

type CredentialInstanceReturnType<Record extends W3cCredentialRecord | SdJwtVcRecord | MdocRecord> =
  Record extends W3cCredentialRecord
    ? W3cVerifiableCredential
    : Record extends SdJwtVcRecord
      ? SdJwtVc
      : Record extends MdocRecord
        ? Mdoc
        : Mdoc | SdJwtVc | W3cVerifiableCredential

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
export async function useInstanceFromCredentialRecord<Record extends W3cCredentialRecord | SdJwtVcRecord | MdocRecord>({
  agentContext,
  useMode,
  credentialRecord,

  updateRecordIfNewInstanceIsUsed = true,
}: {
  agentContext: AgentContext

  /**
   * Which mode to use for usage of the credential instance. See {@link CredentialUseMode} for
   * more information on the available options
   */
  useMode: CredentialUseMode
  credentialRecord: Record

  /**
   * Whether to update the record in storage after a new instance has been used.
   *
   * @default true
   */
  updateRecordIfNewInstanceIsUsed?: boolean

  // TODO: we should do this by default, but we don't support locking yet.
  // /**
  //  * Whether to refetch the record (with a lock) when a new instance is used, to prevent conflicts and race conditions
  //  */
  // refetchAndLockRecordIfNewInstanceIsUsed: boolean
}): Promise<{
  /**
   * The credential instance with the kms key id
   */
  credentialInstance: CredentialInstanceReturnType<Record>

  /**
   * If the first instance was used, this value will be `true`. The first time
   * the first instance is used, technically the credential is not reused yet,
   * but we make no disnticion between this.
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
}> {
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

  let transformedCredentialInstance: W3cVerifiableCredential | Mdoc | SdJwtVc
  if (credentialRecord instanceof MdocRecord) {
    const { issuerSignedBase64Url, kmsKeyId } = credentialInstance as MdocRecordInstances[0]
    transformedCredentialInstance = Mdoc.fromBase64Url(issuerSignedBase64Url)
    transformedCredentialInstance.deviceKeyId = kmsKeyId ?? transformedCredentialInstance.deviceKey.legacyKeyId

    if (!isReused && updateRecordIfNewInstanceIsUsed) {
      // Update record
      const repository = agentContext.resolve(MdocRepository)
      await repository.update(agentContext, credentialRecord)
    }
  } else if (credentialRecord instanceof SdJwtVcRecord) {
    const { compactSdJwtVc, kmsKeyId } = credentialInstance as SdJwtVcRecordInstances[0]

    transformedCredentialInstance = {
      ...decodeSdJwtVc(compactSdJwtVc, credentialRecord.typeMetadata),
      kmsKeyId,
    }

    if (!isReused && updateRecordIfNewInstanceIsUsed) {
      // Update record
      const repository = agentContext.resolve(SdJwtVcRepository)
      await repository.update(agentContext, credentialRecord)
    }
  } else if (credentialRecord instanceof W3cCredentialRecord) {
    const { credential } = credentialInstance as W3cCredentialRecordInstances[0]

    transformedCredentialInstance =
      typeof credential === 'string'
        ? W3cJwtVerifiableCredential.fromSerializedJwt(credential)
        : W3cJsonLdVerifiableCredential.fromJson(credential)

    if (!isReused && updateRecordIfNewInstanceIsUsed) {
      // Update record
      const repository = agentContext.resolve(W3cCredentialRepository)
      await repository.update(agentContext, credentialRecord)
    }
  } else {
    throw new CredoError('Unsupported record type')
  }

  return {
    credentialInstance: transformedCredentialInstance as CredentialInstanceReturnType<Record>,
    isReused,
    isLastNewInstance: credentialRecord.credentialInstances.length === 1 && !isReused,
  }
}
