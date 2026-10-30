import { Resolver } from 'did-resolver'
import * as didWeb from 'web-did-resolver'
import type { AgentContext } from '../../../../agent'
import { JsonTransformer } from '../../../../utils/JsonTransformer'
import { DidDocument } from '../../domain'
import type { DidResolver } from '../../domain/DidResolver'
import type { DidResolutionOptions, DidResolutionResult, ParsedDid } from '../../types'

export interface WebDidResolverOptions {
  /**
   * Maximum size in bytes of a fetched DID document.
   *
   * @default the `maxResponseBytes` of the agent's `fetchLimits`
   */
  maxDidDocumentBytes?: number
}

export class WebDidResolver implements DidResolver {
  public readonly supportedMethods

  public readonly allowsCaching = true
  public readonly allowsLocalDidRecord = true

  private resolver = didWeb.getResolver()
  private options: WebDidResolverOptions

  public constructor(options: WebDidResolverOptions = {}) {
    this.supportedMethods = Object.keys(this.resolver)
    this.options = options
  }

  public async resolve(
    agentContext: AgentContext,
    did: string,
    _parsed: ParsedDid,
    didResolutionOptions: DidResolutionOptions
  ): Promise<DidResolutionResult> {
    const didResolver = new Resolver(
      didWeb.getResolver({
        fetch: (url, init) =>
          agentContext.config.fetch(url, { ...init, maxResponseBytes: this.options.maxDidDocumentBytes }),
      })
    )
    const result = await didResolver.resolve(did, didResolutionOptions)

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
