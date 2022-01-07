import type { ParsedDid, DidResolutionResult, DidResolutionOptions } from '../types'

export interface DidResolver {
  readonly supportedMethods: string[]
  resolve(did: string, parsed: ParsedDid, didResolutionOptions: DidResolutionOptions): Promise<DidResolutionResult>
}
