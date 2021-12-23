// ProtocolVersion is based on supported protocol versions. Will be 1.0 and 2.0 when starting out.
// FIXME: could we get away with just v1 and v2? (no minor version)
// Newer versions of the protocol should be able to handle older versions just fine, so
// if we always use the newest supported version there should be no problem. Only edge case is when we
// want to interact with an agent not supporting the new syntax, but I think they should just ignore the new features then.
export enum CredentialProtocolVersion {
  V1_0 = '1.0',
  V2_0 = '2.0',
}
