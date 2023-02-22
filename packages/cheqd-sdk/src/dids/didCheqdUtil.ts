import type { DidDocument } from '@aries-framework/core'
import type { CheqdNetwork, DIDDocument, MethodSpecificIdAlgo, TVerificationKey } from '@cheqd/sdk'

import {
  createDidPayload,
  createDidVerificationMethod,
  createVerificationKeys,
  DIDModule,
  VerificationMethods,
} from '@cheqd/sdk'
import { MsgCreateDidDocPayload, MsgDeactivateDidDocPayload } from '@cheqd/ts-proto/cheqd/did/v2'
import { bases } from 'multiformats/basics'

export function validateSpecCompliantPayload(didDocument: DidDocument): SpecValidationResult {
  // id is required, validated on both compile and runtime
  if (!didDocument.id && !didDocument.id.startsWith('did:cheqd:')) return { valid: false, error: 'id is required' }

  // verificationMethod is required
  if (!didDocument.verificationMethod) return { valid: false, error: 'verificationMethod is required' }

  // verificationMethod must be an array
  if (!Array.isArray(didDocument.verificationMethod))
    return { valid: false, error: 'verificationMethod must be an array' }

  // verificationMethod must be not be empty
  if (!didDocument.verificationMethod.length) return { valid: false, error: 'verificationMethod must be not be empty' }

  // verificationMethod types must be supported
  const isValidVerificationMethod = didDocument.verificationMethod.every((vm) => {
    switch (vm.type) {
      case VerificationMethods.Ed255192020:
        return vm.publicKeyMultibase != null
      case VerificationMethods.JWK:
        return vm.publicKeyJwk != null
      case VerificationMethods.Ed255192018:
        return vm.publicKeyBase58 != null
      default:
        return false
    }
  })

  if (!isValidVerificationMethod) return { valid: false, error: 'verificationMethod publicKey is Invalid' }

  const isValidService = didDocument.service
    ? didDocument?.service?.every((s) => {
        return Array.isArray(s?.serviceEndpoint) && s?.id && s?.type
      })
    : true

  if (!isValidService) return { valid: false, error: 'Service is Invalid' }
  return { valid: true } as SpecValidationResult
}

// Create helpers in sdk like MsgCreateDidDocPayload.fromDIDDocument to replace the below
export async function MsgCreateDidDocPayloadToSign(didPayload: DIDDocument, versionId: string) {
  const { protobufVerificationMethod, protobufService } = await DIDModule.validateSpecCompliantPayload(didPayload)
  return MsgCreateDidDocPayload.encode(
    MsgCreateDidDocPayload.fromPartial({
      context: <string[]>didPayload?.['@context'],
      id: didPayload.id,
      controller: <string[]>didPayload.controller,
      verificationMethod: protobufVerificationMethod,
      authentication: <string[]>didPayload.authentication,
      assertionMethod: <string[]>didPayload.assertionMethod,
      capabilityInvocation: <string[]>didPayload.capabilityInvocation,
      capabilityDelegation: <string[]>didPayload.capabilityDelegation,
      keyAgreement: <string[]>didPayload.keyAgreement,
      service: protobufService,
      alsoKnownAs: <string[]>didPayload.alsoKnownAs,
      versionId,
    })
  ).finish()
}

export function MsgDeactivateDidDocPayloadToSign(didPayload: DIDDocument, versionId?: string) {
  return MsgDeactivateDidDocPayload.encode(
    MsgDeactivateDidDocPayload.fromPartial({
      id: didPayload.id,
      versionId,
    })
  ).finish()
}

export type SpecValidationResult = {
  valid: boolean
  error?: string
}

export function generateDidDoc(options: IDidDocOptions) {
  const { verificationMethod, methodSpecificIdAlgo, verificationMethodId, network, publicKey } = options
  const verificationKeys = createVerificationKeys(publicKey, methodSpecificIdAlgo, verificationMethodId, network)
  const verificationMethods = createDidVerificationMethod([verificationMethod], [verificationKeys])

  return createDidPayload(verificationMethods, [verificationKeys])
}

export interface IDidDocOptions {
  verificationMethod: VerificationMethods
  verificationMethodId: TVerificationKey<string, number>
  methodSpecificIdAlgo: MethodSpecificIdAlgo
  network: CheqdNetwork
  publicKey: string
}

const MULTICODEC_ED25519_HEADER = new Uint8Array([0xed, 0x01])

export function fromMultibase(key: string): Uint8Array {
  const result = bases['base58btc'].decode(key)
  return result.slice(MULTICODEC_ED25519_HEADER.length)
}
