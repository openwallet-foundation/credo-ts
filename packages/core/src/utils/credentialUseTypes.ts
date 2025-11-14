/**
 * The `CredentialMultiInstanceState` enum represents the state of credential instances on a record.
 */
export enum CredentialMultiInstanceState {
  /**
   * Indicates the credential record is a single instance record, and the instance has been used.
   */
  SingleInstanceUsed = 'SingleInstanceUsed',

  /**
   * Indicates the credential record is a single instance record, and the instance has not been used.
   */
  SingleInstanceUnused = 'SingleInstanceUnused',

  /**
   * Indicates the credential record is a multi instance record, where the first instance is used. It may still have other
   * instances that are unused (which can be detected if the length of credentialInstances > 1)
   */
  MultiInstanceFirstUsed = 'MultiInstanceFirstUsed',

  /**
   * Indicates the credential record is a multi instance record, where the first instance has not been used. It may still have other
   * instances that are unused (which can be detected if the length of credentialInstances > 1)
   */
  MultiInstanceFirstUnused = 'MultiInstanceFirstUnused',
}

/**
 * The `CredentialMultiInstanceUseMode` enum offers different modes for usage of credential instances from records.
 */
export enum CredentialMultiInstanceUseMode {
  /**
   * Always use a new unused instance. If not available an error will be thrown
   * that a new instance could not be extracted. This removes the instance from the record.
   */
  New = 'New',

  /**
   * Use a new unused instance if the credential was received as a batch (mimicking behavior of the `CredentialMultiInstanceUseMode.New` mode).
   * If only a single instance was received it will use the first instance (mimicking behavior of the `CredentialMultiInstanceUseMode.First` mode).
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

export enum CredentialMultiInstanceUseUpdateMode {
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
