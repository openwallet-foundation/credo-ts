import type { Buffer } from '../utils/buffer'

export abstract class KeyPair {
  abstract sign(message: Buffer): Promise<Buffer>

  abstract verify(message: Buffer, signature: Buffer): Promise<boolean>

  abstract get hasPublicKey(): boolean

  abstract get publicKey(): Buffer | undefined

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  abstract fromVerificationMethod(verificationMethod: Record<string, any>): KeyPair
}
