import { type AgentContext, Buffer, DidDocument, JsonTransformer, KeyType, Key } from '@credo-ts/core'
import { createDID, AbstractCrypto, type SigningOutput, type SigningInput } from 'didwebvh-ts'

export class DIDWebvhCrypto extends AbstractCrypto {
  private agentContext?: AgentContext

  public constructor(agentContext?: AgentContext) {
    super({
      verificationMethod: {
        id: 'did:webvh:123',
        controller: 'did:webvh:123',
        type: 'Ed25519VerificationKey2020',
        publicKeyMultibase: '123',
        secretKeyMultibase: '123',
      },
    })
    this.agentContext = agentContext
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async sign(input: SigningInput): Promise<SigningOutput> {
    throw new Error('Not implemented')
  }

  public async verify(signature: Uint8Array, message: Uint8Array, publicKey: Uint8Array): Promise<boolean> {
    try {
      if (!this.agentContext) {
        throw new Error('Agent context is required')
      }

      const key = new Key(publicKey, KeyType.Ed25519)

      return await this.agentContext.wallet.verify({
        key,
        data: Buffer.from(message),
        signature: Buffer.from(signature),
      })
    } catch (error) {
      // Log error in a non-production environment
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.error('Error verifying signature:', error)
      }
      return false
    }
  }
}

export function validateSpecCompliantPayload(didDocument: DidDocument): SpecValidationResult {
  // id is required, validated on both compile and runtime
  if (!didDocument.id || !didDocument.id.startsWith('did:webvh:')) return { valid: false, error: 'id is required' }

  // verificationMethod is required
  if (!didDocument.verificationMethod) return { valid: false, error: 'verificationMethod is required' }

  // verificationMethod must be an array
  if (!Array.isArray(didDocument.verificationMethod))
    return { valid: false, error: 'verificationMethod must be an array' }

  // verificationMethod must be not be empty
  if (!didDocument.verificationMethod.length) return { valid: false, error: 'verificationMethod must be not be empty' }

  return { valid: true }
}

export interface SpecValidationResult {
  valid: boolean
  error?: string
}

export async function generateDidDoc(options: IDidDocOptions, agentContext?: AgentContext) {
  const { verificationMethods, baseUrl, updateKeys } = options

  const { doc } = await createDID({
    domain: baseUrl.replace(/^https?:\/\//, '').replace('/', ':'),
    updateKeys,
    signer: new DIDWebvhCrypto(agentContext),
    verificationMethods: verificationMethods.map((verificationMethod) => ({
      type: 'Multikey',
      publicKeyMultibase: verificationMethod.publicKeyMultibase,
    })),
  })

  return JsonTransformer.fromJSON(doc, DidDocument)
}

export interface IDidDocOptions {
  verificationMethods: {
    publicKeyMultibase: string
    privateKeyMultibase?: string
  }[]
  updateKeys: string[]
  baseUrl: string
}
