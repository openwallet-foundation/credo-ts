export * from './v2'

import * as ProofProtocolOptions from './DidCommProofProtocolOptions'

// NOTE: ideally we don't export the BaseProofProtocol, but custom proof protocols defined in other
// packages extend it, so we need to export it. We should at some point look at creating a core package which can be used for
// sharing internal types, and when you want to build you own modules, and an agent package, which is the one you use when
// consuming the framework
export { DidCommBaseProofProtocol } from './DidCommBaseProofProtocol'
export type { DidCommProofProtocol } from './DidCommProofProtocol'
export { ProofProtocolOptions }
