export type Bytes = Uint8Array
export type BytesArray = Uint8Array[]

export abstract class KeyPair {
  abstract sign(message: Bytes | BytesArray): Promise<Bytes>

  abstract verify(message: Bytes | BytesArray, signature: Bytes): Promise<boolean>

  abstract get hasPublicKey(): boolean

  abstract get publicKey(): Bytes | undefined

  abstract fromVerificationMethod(verificationMethod: Record<string, string>): KeyPair
}
