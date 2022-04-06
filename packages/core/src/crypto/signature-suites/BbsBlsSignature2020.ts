import type { SignatureSuiteOptions } from '@mattrglobal/jsonld-signatures-bbs'

import { BbsBlsSignature2020 as MattrBbsBlsSignature2020 } from '@mattrglobal/jsonld-signatures-bbs'

export class BbsBlsSignature2020 extends MattrBbsBlsSignature2020 {
  public constructor(options?: SignatureSuiteOptions) {
    super(options)
  }

  public ensureSuiteContext({ document }: any) {
    const contextUrl = 'https://w3id.org/security/bbs/v1'
    if (
      document['@context'] === contextUrl ||
      (Array.isArray(document['@context']) && document['@context'].includes(contextUrl))
    ) {
      // document already includes the required context
      return
    }
    throw new TypeError(`The document to be signed must contain this suite's @context, ` + `"${contextUrl}".`)
  }
}
