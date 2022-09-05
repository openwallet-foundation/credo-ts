import type { EmulatorUserConfig } from './UserEmulator'
import type { EmulatorWitnessConfig } from './WitnessEmulator'
import type { WitnessInfo } from '@sicpa-dlab/value-transfer-protocol-ts'

import {
  Key,
  DidCommV2Service,
  DidDocumentBuilder,
  getEd25519VerificationMethod,
  getX25519VerificationMethod,
  KeyType,
  DidPeer,
  PeerDidNumAlgo,
} from '@aries-framework/core'
import * as ed25519 from '@stablelib/ed25519'

const URL_PROTOCOL_SCHEME = 'http'

interface CreateDidResult {
  did: string
}

interface CreateWitnessResult {
  publicDid: string
  gossipDid: string
}

interface CreatePeerDidOptions {
  seed?: string
  serviceEndpoints: { http?: string }
}

function createPeerDid(options: CreatePeerDidOptions) {
  const { seed, serviceEndpoints } = options

  const keyPair = seed ? ed25519.generateKeyPairFromSeed(Buffer.from(seed)) : ed25519.generateKeyPair()
  const publicKeyX25519 = ed25519.convertPublicKeyToX25519(keyPair.publicKey)

  const ed25519Key = Key.fromPublicKey(keyPair.publicKey, KeyType.Ed25519)
  const x25519Key = Key.fromPublicKey(publicKeyX25519, KeyType.X25519)

  const didDocumentBuilder = new DidDocumentBuilder('')
    .addAuthentication(getEd25519VerificationMethod({ controller: '', id: '', key: ed25519Key }))
    .addKeyAgreement(getX25519VerificationMethod({ controller: '', id: '', key: x25519Key }))

  if (serviceEndpoints.http) {
    didDocumentBuilder.addService(
      new DidCommV2Service({
        id: URL_PROTOCOL_SCHEME.toUpperCase(),
        serviceEndpoint: serviceEndpoints.http,
        routingKeys: [],
      })
    )
  }

  const didPeer = DidPeer.fromDidDocument(didDocumentBuilder.build(), PeerDidNumAlgo.MultipleInceptionKeyWithoutDoc)

  return {
    did: didPeer.did,
  }
}

function createUserDid(config: EmulatorUserConfig): CreateDidResult {
  const endpoint = `${config.host}:${config.port}`
  return createPeerDid({ seed: config.publicDidSeed, serviceEndpoints: { http: endpoint } })
}

function createWitnessDid(options: { seed?: string; host: string }): CreateDidResult {
  const { seed, host } = options
  return createPeerDid({ seed, serviceEndpoints: { http: host } })
}

const createWitnessConfig = (config: EmulatorWitnessConfig, witnessTable: WitnessInfo[]): CreateWitnessResult => {
  const endpoint = `${config.host}:${config.port}`
  const publicDid = createWitnessDid({
    host: endpoint,
    seed: config.publicDidSeed,
  })
  const gossipDid = createWitnessDid({
    host: endpoint,
    seed: config.gossipDidSeed,
  })
  witnessTable.push({
    label: config.label,
    publicDid: publicDid.did,
    gossipDid: gossipDid.did,
    type: config.type,
    wid: config.wid ?? config.port!.toString(),
  })
  return {
    publicDid: publicDid.did,
    gossipDid: gossipDid.did,
  }
}

export const createUsersList = (users: EmulatorUserConfig[]): string[] => {
  return users.map((user) => createUserDid(user).did)
}

export const createWitnessTable = (witnesses: EmulatorWitnessConfig[]): WitnessInfo[] => {
  const witnessTable: WitnessInfo[] = []
  witnesses.forEach((witnessConfig) => createWitnessConfig(witnessConfig, witnessTable))
  return witnessTable
}
