import type * as AriesAskarShared from '@hyperledger/aries-askar-shared'
import type * as AskarShared from '@openwallet-foundation/askar-shared'

let askarLibrary: typeof AriesAskarShared | typeof AskarShared | undefined = undefined

export type AskarLibrary = typeof AriesAskarShared | typeof AskarShared
export type HyperledgerAskarLibrary = typeof AriesAskarShared
export type OwfAskarLibrary = typeof AskarShared

export function importAskar(askar: AriesAskarShared.AriesAskar | AskarShared.Askar) {
  if (askarLibrary) return askarLibrary

  // Determine the library that is used based on the version
  const version = askar.version()
  if (version.startsWith('0.3.')) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    askarLibrary = require('@hyperledger/aries-askar-shared') as typeof AriesAskarShared
  } else {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    askarLibrary = require('@openwallet-foundation/askar-shared') as typeof AskarShared
  }

  return askarLibrary
}

export function isOwfAskarLibrary(askarLibrary: AskarLibrary): askarLibrary is OwfAskarLibrary {
  return (askarLibrary as OwfAskarLibrary).AskarError !== undefined
}

export function isHyperledgerAskarLibrary(askarLibrary: AskarLibrary): askarLibrary is OwfAskarLibrary {
  return (askarLibrary as HyperledgerAskarLibrary).AriesAskarError !== undefined
}

export type Session = InstanceType<AskarLibrary['Session']>
export type OwfSession = InstanceType<OwfAskarLibrary['Session']>
export type HyperledgerSession = InstanceType<HyperledgerAskarLibrary['Session']>

export type Store = InstanceType<AskarLibrary['Store']>
export type OwfStore = InstanceType<OwfAskarLibrary['Store']>
export type HyperledgerStore = InstanceType<HyperledgerAskarLibrary['Store']>

export type AskarKey = InstanceType<AskarLibrary['Key']>
export type HyperledgerAskarKey = InstanceType<HyperledgerAskarLibrary['Key']>
export type OwfAskarKey = InstanceType<OwfAskarLibrary['Key']>

export type AskarError =
  | InstanceType<OwfAskarLibrary['AskarError']>
  | InstanceType<HyperledgerAskarLibrary['AriesAskarError']>

export function isOwfAskarKey(askarLibrary: AskarLibrary, key: AskarKey): key is OwfAskarKey {
  return isOwfAskarLibrary(askarLibrary)
}

export const AskarStoreSymbol = Symbol('AskarStore')
