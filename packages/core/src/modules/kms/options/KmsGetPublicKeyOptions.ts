import * as v from '../../../utils/valibot'

export const vKmsGetPublicKeyOptions = v.object({
  keyId: v.string(),
})

export interface KmsGetPublicKeyOptions {
  /**
   * The key id of the key to get the public bytes for.
   */
  keyId: string
}
