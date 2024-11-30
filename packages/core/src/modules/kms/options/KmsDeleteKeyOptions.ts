import * as v from '../../../utils/valibot'

export const vKmsDeleteKeyOptions = v.object({
  keyId: v.string(),
})

export interface KmsDeleteKeyOptions {
  /**
   * The `kid` for the key.
   */
  keyId: string
}
