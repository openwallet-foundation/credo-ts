import type { ParsedDID, DIDResolutionResult, DIDResolutionOptions } from '../types'

export interface DidResolver {
  readonly supportedMethods: string[]
  resolve(did: string, parsed: ParsedDID, didResolutionOptions: DIDResolutionOptions): Promise<DIDResolutionResult>
}
