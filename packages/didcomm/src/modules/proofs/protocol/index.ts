export * from './v2'
import * as ProofProtocolOptions from './DidCommProofProtocolOptions'

export { DidCommProofProtocol as ProofProtocol } from './DidCommProofProtocol'
// NOTE: ideally we don't export the BaseProofProtocol, but as the V1ProofProtocol is defined in the
// anoncreds package, we need to export it. We should at some point look at creating a core package which can be used for
// sharing internal types, and when you want to build you own modules, and an agent package, which is the one you use when
// consuming the framework
export { DidCommBaseProofProtocol as BaseProofProtocol } from './DidCommBaseProofProtocol'
export { ProofProtocolOptions }
