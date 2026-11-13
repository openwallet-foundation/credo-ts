const v1ThreadRegex =
  /(indy)::((?:[\dA-z]{21,22}):4:(?:[\dA-z]{21,22}):3:[Cc][Ll]:(?:(?:[1-9][0-9]*)|(?:[\dA-z]{21,22}:2:.+:[0-9.]+)):.+?:CL_ACCUM:(?:[\dA-z-]+))::(\d+)$/

const v2IndyRevocationFormat = 'indy-anoncreds'
const v2AnonCredsRevocationFormat = 'anoncreds'

const v2IndyRevocationIdentifierRegex =
  /((?:[\dA-z]{21,22}):4:(?:[\dA-z]{21,22}):3:[Cc][Ll]:(?:(?:[1-9][0-9]*)|(?:[\dA-z]{21,22}:2:.+:[0-9.]+)):.+?:CL_ACCUM:(?:[\dA-z-]+))::(\d+)$/
const v2AnonCredsRevocationIdentifierRegex = /([a-zA-Z0-9+\-.]+:.+)::(\d+)$/

export {
  v1ThreadRegex,
  v2AnonCredsRevocationFormat,
  v2AnonCredsRevocationIdentifierRegex,
  v2IndyRevocationFormat,
  v2IndyRevocationIdentifierRegex,
}
