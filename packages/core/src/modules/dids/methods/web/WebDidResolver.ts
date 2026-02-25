import { Resolver } from 'did-resolver'
import * as didWeb from 'web-did-resolver'
import type { AgentContext } from '../../../../agent'
import { JsonTransformer } from '../../../../utils/JsonTransformer'
import { DidDocument } from '../../domain'
import type { DidResolver } from '../../domain/DidResolver'
import type { DidResolutionOptions, DidResolutionResult, ParsedDid } from '../../types'

export class WebDidResolver implements DidResolver {
  public readonly supportedMethods

  public readonly allowsCaching = true
  public readonly allowsLocalDidRecord = true

  // FIXME: Would be nice if we don't have to provide a did resolver instance
  private _resolverInstance = new Resolver()
  private resolver = didWeb.getResolver()

  public constructor() {
    this.supportedMethods = Object.keys(this.resolver)
  }

  public async resolve(
    _agentContext: AgentContext,
    did: string,
    parsed: ParsedDid,
    didResolutionOptions: DidResolutionOptions
  ): Promise<DidResolutionResult> {
    const result = await this.resolver[parsed.method](did, parsed, this._resolverInstance, didResolutionOptions)

    let didDocument = null

    // If the did document uses the deprecated publicKey property
    // we map it to the newer verificationMethod property
    if (!result.didDocument?.verificationMethod && result.didDocument?.publicKey) {
      result.didDocument.verificationMethod = result.didDocument.publicKey
    }

    if (result.didDocument) {
      didDocument = JsonTransformer.fromJSON(result.didDocument, DidDocument)
    }

    return {
      ...result,
      didDocument,
    }
  }
}
