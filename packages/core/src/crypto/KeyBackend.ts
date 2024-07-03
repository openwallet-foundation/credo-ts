export enum KeyBackend {
  /**
   *
   * Generate a key using common software-based implementations.
   * Key material will be instantiated in memory.
   *
   * Supported for almost all, if not all, key types.
   *
   */
  Software = 'Software',

  /**
   *
   * Generate a key within the secure element of the device.
   *
   * For now, this is only supported using Aries Askar in iOS or Android for `KeyType.P256`.
   *
   */
  SecureElement = 'SecureElement',
}
