import type { CheqdNetwork, DIDDocument, MethodSpecificIdAlgo, TVerificationKey, VerificationMethod } from '@cheqd/sdk'
import {
  createDidPayload,
  createDidVerificationMethod,
  createVerificationKeys,
  DIDModule,
  VerificationMethods,
} from '@cheqd/sdk'
import { MsgCreateDidDocPayload, MsgDeactivateDidDocPayload } from '@cheqd/ts-proto/cheqd/did/v2'
import type { Metadata } from '@cheqd/ts-proto/cheqd/resource/v2'
import { EnglishMnemonic as _EnglishMnemonic } from '@cosmjs/crypto'
import { DirectSecp256k1HdWallet, DirectSecp256k1Wallet } from '@cosmjs/proto-signing'
import {
  type AnyUint8Array,
  CredoError,
  DidCommV1Service,
  DidDocument,
  JsonEncoder,
  JsonTransformer,
  TypedArrayEncoder,
} from '@credo-ts/core'

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
        return s?.serviceEndpoint && s?.id && s?.type
      })
    : true

  if (!isValidService) return { valid: false, error: 'Service is Invalid' }
  return { valid: true } as SpecValidationResult
}

// Create helpers in sdk like MsgCreateDidDocPayload.fromDIDDocument to replace the below
export async function createMsgCreateDidDocPayloadToSign(didPayload: DIDDocument, versionId: string) {
  didPayload.service = didPayload.service?.map((e) => {
    return {
      ...e,
      // For DIDComm V1 services (V2 already supports array), keep serviceEndpoint as string
      // For other services, convert to array if not already
      serviceEndpoint:
        e.type === DidCommV1Service.type
          ? e.serviceEndpoint
          : Array.isArray(e.serviceEndpoint)
            ? e.serviceEndpoint
            : [e.serviceEndpoint],
    }
  })
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

export function createMsgDeactivateDidDocPayloadToSign(didPayload: DIDDocument, versionId?: string) {
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
  if (!verificationKeys) {
    throw new Error('Invalid DID options')
  }
  const verificationMethods = createDidVerificationMethod([verificationMethod], [verificationKeys])
  const didPayload = createDidPayload(verificationMethods, [verificationKeys])
  return JsonTransformer.fromJSON(didPayload, DidDocument)
}

export interface IDidDocOptions {
  verificationMethod: VerificationMethods
  verificationMethodId: TVerificationKey<string, number>
  methodSpecificIdAlgo: MethodSpecificIdAlgo
  network: CheqdNetwork
  publicKey: string
}

export function getClosestResourceVersion(resources: Metadata[], date: Date) {
  let minDiff = Number.POSITIVE_INFINITY
  let closest: Metadata | undefined

  // TODO: if the cheqd/sdk returns sorted resources, change this to binary search
  for (const resource of resources) {
    if (!resource.created) throw new CredoError("Missing required property 'created' on resource")

    // NOTE: The date passed in is based on seconds, while we compare with milliseconds
    // this results in invalid results due to the precision being lost. So we floor the result
    // allowing for some leeway in time differences
    const resourceCreatedAt = new Date(Math.floor(resource.created.getTime() / 1000) * 1000)

    if (resourceCreatedAt.getTime() <= date.getTime()) {
      const diff = date.getTime() - resourceCreatedAt.getTime()

      if (diff < minDiff) {
        closest = resource
        minDiff = diff
      }
    }
  }

  return closest
}

export function filterResourcesByNameAndType(resources: Metadata[], name: string, type: string) {
  return resources.filter((resource) => resource.name === name && resource.resourceType === type)
}

export async function renderResourceData(data: AnyUint8Array, mimeType: string) {
  if (mimeType === 'application/json') {
    return await JsonEncoder.fromBuffer(data)
  }
  if (mimeType === 'text/plain') {
    return TypedArrayEncoder.toUtf8String(data)
  }
  return TypedArrayEncoder.toBase64URL(data)
}

export class EnglishMnemonic extends _EnglishMnemonic {
  public static readonly _mnemonicMatcher = /^[a-z]+( [a-z]+)*$/
}

export function getCosmosPayerWallet(cosmosPayerSeed?: string) {
  if (!cosmosPayerSeed || cosmosPayerSeed === '') {
    return DirectSecp256k1HdWallet.generate()
  }
  return EnglishMnemonic._mnemonicMatcher.test(cosmosPayerSeed)
    ? DirectSecp256k1HdWallet.fromMnemonic(cosmosPayerSeed, { prefix: 'cheqd' })
    : DirectSecp256k1Wallet.fromKey(TypedArrayEncoder.fromString(cosmosPayerSeed.replace(/^0x/, '')), 'cheqd')
}

export function getVerificationMethodId(vm: string | VerificationMethod) {
  return typeof vm === 'string' ? vm : vm.id
}

export function dereferenceVerificationMethod(didDocument: DidDocument, vm: string | VerificationMethod) {
  return typeof vm === 'string' ? didDocument.dereferenceVerificationMethod(vm) : vm
}
