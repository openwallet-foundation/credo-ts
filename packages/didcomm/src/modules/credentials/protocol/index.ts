export * from './v2'
export * from './revocation-notification'
import * as CredentialProtocolOptions from './DidCommCredentialProtocolOptions'

export { DidCommCredentialProtocol } from './DidCommCredentialProtocol'
// NOTE: ideally we don't export the BaseDidCommCredentialProtocol, but as the DidCommCredentialV1Protocol is defined in the
// anoncreds package, we need to export it. We should at some point look at creating a core package which can be used for
// sharing internal types, and when you want to build you own modules, and an agent package, which is the one you use when
// consuming the framework
export { DidCommBaseCredentialProtocol as BaseDidCommCredentialProtocol } from './DidCommBaseCredentialProtocol'
export { CredentialProtocolOptions }
