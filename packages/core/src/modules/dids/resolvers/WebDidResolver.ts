import type { ParsedDID, DIDResolutionResult, DIDResolutionOptions } from '../types'
import type { DidResolver } from './DidResolver'

import { Resolver } from 'did-resolver'
import * as didWeb from 'web-did-resolver'

export class WebDidResolver implements DidResolver {
  public readonly supportedMethods

  // FIXME: Would be nice if we don't have to provide a did resolver instance
  private _resolverInstance = new Resolver()
  private resolver = didWeb.getResolver()

  public constructor() {
    this.supportedMethods = Object.keys(this.resolver)
  }

  public async resolve(
    did: string,
    parsed: ParsedDID,
    didResolutionOptions: DIDResolutionOptions
  ): Promise<DIDResolutionResult> {
    return this.resolver[parsed.method](did, parsed, this._resolverInstance, didResolutionOptions)
  }
}
