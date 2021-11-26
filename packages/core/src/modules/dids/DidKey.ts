import type { VerificationMethod, DIDDocument } from './types'

import { varint } from 'multiformats'

import { BufferEncoder } from '../../utils/BufferEncoder'
import { MultiBaseEncoder } from '../../utils/MultiBaseEncoder'

import { DidDocumentBuilder } from './DidDocumentBuilder'
import { parseDidUrl } from './parse'

const enum KeyType {
  ED25519 = 'ed25519',
  X25519 = 'x25519',
  BLS12381G1 = 'bls12381g1',
  BLS12381G2 = 'bls12381g2',
  BLS12381G1G2 = 'bls12381g1g2',
}

const keyTypeResolverMap: Record<KeyType, (didKey: DidKey) => DIDDocument> = {
  [KeyType.ED25519]: getEd25519DidDoc,
  [KeyType.X25519]: getX25519DidDoc,
  [KeyType.BLS12381G1]: getBls12381g1DidDoc,
  [KeyType.BLS12381G2]: getBls12381g2DidDoc,
  [KeyType.BLS12381G1G2]: getBls12381g1g2DidDoc,
}

// based on https://github.com/multiformats/multicodec/blob/master/table.csv
const idPrefixMap: Record<number, KeyType> = {
  234: KeyType.BLS12381G1,
  235: KeyType.BLS12381G2,
  236: KeyType.X25519,
  237: KeyType.ED25519,
  238: KeyType.BLS12381G1G2,
}

export class DidKey {
  public readonly publicKey: Uint8Array
  public readonly keyType: KeyType

  public constructor(publicKey: Uint8Array, keyType: KeyType) {
    this.publicKey = publicKey
    this.keyType = keyType
  }

  public static fromDid(did: string) {
    const parsed = parseDidUrl(did)

    if (!parsed) {
      throw new Error('Unable to parse did')
    }

    return DidKey.fromFingerprint(parsed.id)
  }

  public static fromPublicKey(publicKey: Uint8Array, keyType: KeyType) {
    return new DidKey(publicKey, keyType)
  }

  public static fromFingerprint(fingerprint: string) {
    const { data } = MultiBaseEncoder.decode(fingerprint)
    const [code, byteLength] = varint.decode(data)

    const publicKey = data.slice(byteLength)
    const keyType = idPrefixMap[code]

    return new DidKey(publicKey, keyType)
  }

  public get prefixedPublicKey() {
    const codes = Object.keys(idPrefixMap) as unknown as number[]
    const code = codes.find((key) => idPrefixMap[key] === this.keyType) as number

    // Create Uint8Array with length of the prefix bytes, then use varint to fill the prefix bytes
    const prefixBytes = varint.encodeTo(code, new Uint8Array(varint.encodingLength(code)))

    // Combine prefix with public key
    return new Uint8Array([...prefixBytes, ...this.publicKey])
  }

  public get fingerprint() {
    return `z${BufferEncoder.toBase58(this.prefixedPublicKey)}`
  }

  public get did() {
    return `did:key:${this.fingerprint}`
  }

  public get didDocument() {
    const resolve = keyTypeResolverMap[this.keyType]

    return resolve(this)
  }

  public get publicKeyBase58() {
    return BufferEncoder.toBase58(this.publicKey)
  }

  public get keyId() {
    return `${this.did}#${this.fingerprint}`
  }
}

function getBls12381g2DidDoc(didKey: DidKey) {
  return getSignatureKeyBase(didKey, {
    id: didKey.keyId,
    type: 'Bls12381G2Key2020',
    controller: didKey.did,
    publicKeyBase58: didKey.publicKeyBase58,
  }).build()
}

function getBls12381g1g2DidDoc(didKey: DidKey) {
  const g1PublicKey = didKey.publicKey.slice(0, 48)
  const g2PublicKey = didKey.publicKey.slice(48)

  const bls12381g1Key = DidKey.fromPublicKey(g1PublicKey, KeyType.BLS12381G1)
  const bls12381g2Key = DidKey.fromPublicKey(g2PublicKey, KeyType.BLS12381G2)

  const bls12381g1KeyId = `${didKey.did}#${bls12381g1Key.fingerprint}`
  const bls12381g2KeyId = `${didKey.did}#${bls12381g2Key.fingerprint}`

  const didDocumentBuilder = new DidDocumentBuilder(didKey.did)
    // BlS12381G1
    .addVerificationMethod({
      id: bls12381g1KeyId,
      type: 'Bls12381G1Key2020',
      controller: didKey.did,
      publicKeyBase58: bls12381g1Key.publicKeyBase58,
    })
    .addAuthentication(bls12381g1KeyId)
    .addAssertionMethod(bls12381g1KeyId)
    .addCapabilityDelegation(bls12381g1KeyId)
    .addCapabilityInvocation(bls12381g1KeyId)
    // BlS12381G2
    .addVerificationMethod({
      id: bls12381g2KeyId,
      type: 'Bls12381G2Key2020',
      controller: didKey.did,
      publicKeyBase58: bls12381g2Key.publicKeyBase58,
    })
    .addAuthentication(bls12381g2KeyId)
    .addAssertionMethod(bls12381g2KeyId)
    .addCapabilityDelegation(bls12381g2KeyId)
    .addCapabilityInvocation(bls12381g2KeyId)

  return didDocumentBuilder.build()
}

function getBls12381g1DidDoc(didKey: DidKey) {
  return getSignatureKeyBase(didKey, {
    id: didKey.keyId,
    type: 'Bls12381G1Key2020',
    controller: didKey.did,
    publicKeyBase58: didKey.publicKeyBase58,
  }).build()
}

function getX25519DidDoc(didKey: DidKey) {
  return new DidDocumentBuilder(didKey.did)
    .addKeyAgreement({
      id: didKey.keyId,
      type: 'X25519KeyAgreementKey2019',
      controller: didKey.did,
      publicKeyBase58: didKey.publicKeyBase58,
    })
    .build()
}

function getEd25519DidDoc(didKey: DidKey) {
  const verificationMethod: VerificationMethod = {
    id: didKey.keyId,
    type: 'Ed25519VerificationKey2018',
    controller: didKey.did,
    publicKeyBase58: didKey.publicKeyBase58,
  }

  const didDocBuilder = getSignatureKeyBase(didKey, verificationMethod)

  // FIXME: Currently no method to transform ed25519 public key to x25519 public key
  // We could use https://www.npmjs.com/package/@stablelib/ed25519 but it will add another dependency
  // const didKeyX25519 = new DidKey(, KeyType.X25519)
  // didDocBuilder.addKeyAgreement({
  //   id: `${didKey.did}#${didKeyX25519.fingerprint}`,
  //   type: 'X25519KeyAgreementKey2019',
  //   controller: didKey.did,
  //   publicKeyBase58: didKeyX25519.publicKeyBase58,
  // })

  return didDocBuilder.build()
}

function getSignatureKeyBase(didKey: DidKey, verificationMethod: VerificationMethod) {
  const keyId = didKey.keyId

  return new DidDocumentBuilder(didKey.did)
    .addVerificationMethod(verificationMethod)
    .addAuthentication(keyId)
    .addAssertionMethod(keyId)
    .addCapabilityDelegation(keyId)
    .addCapabilityInvocation(keyId)
}
