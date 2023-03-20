import type { JsonObject } from '../../../../types'
import type { OutOfBandDidCommService } from '../../../oob/domain/OutOfBandDidCommService'
import type { DidDocument, VerificationMethod } from '../../domain'

import { Key } from '../../../../crypto'
import { JsonEncoder, JsonTransformer } from '../../../../utils'
import { DidCommV1Service, DidDocumentService } from '../../domain'
import { DidDocumentBuilder } from '../../domain/DidDocumentBuilder'
import { getKeyFromVerificationMethod, getKeyDidMappingByKeyType } from '../../domain/key-type'
import { parseDid } from '../../domain/parse'
import { DidKey } from '../key'

enum DidPeerPurpose {
  Assertion = 'A',
  Encryption = 'E',
  Verification = 'V',
  CapabilityInvocation = 'I',
  CapabilityDelegation = 'D',
  Service = 'S',
}

function isDidPeerKeyPurpose(purpose: string): purpose is Exclude<DidPeerPurpose, DidPeerPurpose.Service> {
  return purpose !== DidPeerPurpose.Service && Object.values(DidPeerPurpose).includes(purpose as DidPeerPurpose)
}

const didPeerAbbreviations: { [key: string]: string | undefined } = {
  type: 't',
  DIDCommMessaging: 'dm',
  serviceEndpoint: 's',
  routingKeys: 'r',
  accept: 'a',
}

const didPeerExpansions: { [key: string]: string | undefined } = {
  t: 'type',
  dm: 'DIDCommMessaging',
  s: 'serviceEndpoint',
  r: 'routingKeys',
  a: 'accept',
}

export function didToNumAlgo2DidDocument(did: string) {
  const parsed = parseDid(did)
  const identifierWithoutNumAlgo = parsed.id.substring(2)

  // Get a list of all did document entries splitted by .
  const entries = identifierWithoutNumAlgo.split('.')
  const didDocument = new DidDocumentBuilder(did)
  let serviceIndex = 0

  for (const entry of entries) {
    // Remove the purpose identifier to get the service or key content
    const entryContent = entry.substring(1)
    // Get the purpose identifier
    const purpose = entry[0]

    // Handle service entry first
    if (purpose === DidPeerPurpose.Service) {
      let services = JsonEncoder.fromBase64(entryContent)

      // Make sure we have an array of services (can be both json or array)
      services = Array.isArray(services) ? services : [services]

      for (let service of services) {
        // Expand abbreviations used for service key/values
        service = expandServiceAbbreviations(service)

        service.id = `${did}#${service.type.toLowerCase()}-${serviceIndex++}`

        didDocument.addService(JsonTransformer.fromJSON(service, DidDocumentService))
      }
    }
    // Otherwise we can be sure it is a key
    else {
      // Decode the fingerprint, and extract the verification method(s)
      const key = Key.fromFingerprint(entryContent)
      const { getVerificationMethods } = getKeyDidMappingByKeyType(key.keyType)
      const verificationMethods = getVerificationMethods(did, key)

      // Add all verification methods to the did document
      for (const verificationMethod of verificationMethods) {
        // FIXME: the peer did uses key identifiers without the multi base prefix
        // However method 0 (and thus did:key) do use the multi base prefix in the
        // key identifier. Fixing it like this for now, before making something more complex
        verificationMethod.id = verificationMethod.id.replace('#z', '#')
        addVerificationMethodToDidDocument(didDocument, verificationMethod, purpose)
      }
    }
  }

  return didDocument.build()
}

export function didDocumentToNumAlgo2Did(didDocument: DidDocument) {
  const purposeMapping = {
    [DidPeerPurpose.Assertion]: didDocument.assertionMethod,
    [DidPeerPurpose.Encryption]: didDocument.keyAgreement,
    // FIXME: should verification be authentication or verificationMethod
    // verificationMethod is general so it doesn't make a lot of sense to add
    // it to the verificationMethod list
    [DidPeerPurpose.Verification]: didDocument.authentication,
    [DidPeerPurpose.CapabilityInvocation]: didDocument.capabilityInvocation,
    [DidPeerPurpose.CapabilityDelegation]: didDocument.capabilityDelegation,
  }

  let did = 'did:peer:2'

  for (const [purpose, entries] of Object.entries(purposeMapping)) {
    // Not all entries are required to be defined
    if (entries === undefined) continue

    // Dereference all entries to full verification methods
    const dereferenced = entries.map((entry) =>
      typeof entry === 'string' ? didDocument.dereferenceVerificationMethod(entry) : entry
    )

    // Transform als verification methods into a fingerprint (multibase, multicodec)
    const encoded = dereferenced.map((entry) => {
      const key = getKeyFromVerificationMethod(entry)

      // Encode as '.PurposeFingerprint'
      const encoded = `.${purpose}${key.fingerprint}`

      return encoded
    })

    // Add all encoded keys
    did += encoded.join('')
  }

  if (didDocument.service && didDocument.service.length > 0) {
    const abbreviatedServices = didDocument.service.map((service) => {
      // Transform to JSON, remove id property
      const serviceJson = JsonTransformer.toJSON(service)
      delete serviceJson.id

      return abbreviateServiceJson(serviceJson)
    })

    const encodedServices = JsonEncoder.toBase64URL(
      // If array length is 1, encode as json object. Otherwise as array
      // This is how it's done in the python peer did implementation.
      abbreviatedServices.length === 1 ? abbreviatedServices[0] : abbreviatedServices
    )

    did += `.${DidPeerPurpose.Service}${encodedServices}`
  }

  return did
}

export function outOfBandServiceToNumAlgo2Did(service: OutOfBandDidCommService) {
  // FIXME: add the key entries for the recipientKeys to the did document.
  const didDocument = new DidDocumentBuilder('')
    .addService(
      new DidCommV1Service({
        id: service.id,
        serviceEndpoint: service.serviceEndpoint,
        accept: service.accept,
        // FIXME: this should actually be local key references, not did:key:123#456 references
        recipientKeys: service.recipientKeys.map((recipientKey) => {
          const did = DidKey.fromDid(recipientKey)
          return `${did.did}#${did.key.fingerprint}`
        }),
        // Map did:key:xxx to actual did:key:xxx#123
        routingKeys: service.routingKeys?.map((routingKey) => {
          const did = DidKey.fromDid(routingKey)
          return `${did.did}#${did.key.fingerprint}`
        }),
      })
    )
    .build()

  const did = didDocumentToNumAlgo2Did(didDocument)

  return did
}

function expandServiceAbbreviations(service: JsonObject) {
  const expand = (abbreviated: string) => didPeerExpansions[abbreviated] ?? abbreviated

  const fullService = Object.entries(service).reduce(
    (serviceBody, [key, value]) => ({
      ...serviceBody,
      [expand(key)]: expand(value as string),
    }),
    {}
  )

  return fullService
}

function abbreviateServiceJson(service: JsonObject) {
  const abbreviate = (expanded: string) => didPeerAbbreviations[expanded] ?? expanded

  const abbreviatedService = Object.entries(service).reduce(
    (serviceBody, [key, value]) => ({
      ...serviceBody,
      [abbreviate(key)]: abbreviate(value as string),
    }),
    {}
  )

  return abbreviatedService
}

function addVerificationMethodToDidDocument(
  didDocument: DidDocumentBuilder,
  verificationMethod: VerificationMethod,
  purpose: string
) {
  const purposeMapping = {
    [DidPeerPurpose.Assertion]: didDocument.addAssertionMethod.bind(didDocument),
    [DidPeerPurpose.Encryption]: didDocument.addKeyAgreement.bind(didDocument),
    // FIXME: should verification be authentication or verificationMethod
    // verificationMethod is general so it doesn't make a lot of sense to add
    // it to the verificationMethod list
    [DidPeerPurpose.Verification]: didDocument.addAuthentication.bind(didDocument),
    [DidPeerPurpose.CapabilityInvocation]: didDocument.addCapabilityInvocation.bind(didDocument),
    [DidPeerPurpose.CapabilityDelegation]: didDocument.addCapabilityDelegation.bind(didDocument),
  }

  // Verify the purpose is a did peer key purpose (service excluded)
  if (isDidPeerKeyPurpose(purpose)) {
    const addVerificationMethod = purposeMapping[purpose]

    // Add the verification method based on the method from the mapping
    addVerificationMethod(verificationMethod)
  } else {
    throw new Error(`Unsupported peer did purpose '${purpose}'`)
  }
}
