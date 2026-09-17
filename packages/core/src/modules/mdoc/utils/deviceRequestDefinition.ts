import type { DeviceRequestMatchOptions } from '@owf/mdoc'
import type { MdocDcApiDocRequest, MdocDeviceRequestDefinition } from '../MdocOptions'

/**
 * Create the device request definition stored on a verification session from the doc requests a
 * verifier passed, with every requested element in its object form.
 */
export const createDeviceRequestDefinition = (
  docRequests: MdocDcApiDocRequest[],
  treatAmbiguousMultipleDocRequestsAsAlternatives?: boolean
): MdocDeviceRequestDefinition => ({
  treatAmbiguousMultipleDocRequestsAsAlternatives,
  docRequests: docRequests.map(({ docType, nameSpaces }) => ({
    docType,
    nameSpaces: Object.fromEntries(
      Object.entries(nameSpaces).map(([nameSpace, elements]) => [
        nameSpace,
        Object.fromEntries(
          Object.entries(elements).map(([elementIdentifier, element]) => [
            elementIdentifier,
            typeof element === 'boolean' ? { intentToRetain: element } : element,
          ])
        ),
      ])
    ),
  })),
})

/**
 * The options `@owf/mdoc` matches a device response against the device request with, from the
 * device request definition of a verification session.
 */
export const getDeviceRequestMatchOptions = (definition: MdocDeviceRequestDefinition): DeviceRequestMatchOptions => ({
  treatAmbiguousMultipleDocRequestsAsAlternatives: definition.treatAmbiguousMultipleDocRequestsAsAlternatives,
  docRequests: definition.docRequests.map(({ nameSpaces }, docRequestIndex) => ({
    docRequestIndex,
    elements: Object.fromEntries(
      Object.entries(nameSpaces).map(([nameSpace, elements]) => [
        nameSpace,
        Object.fromEntries(
          Object.entries(elements).map(([elementIdentifier, { optional, source }]) => [
            elementIdentifier,
            { optional, source },
          ])
        ),
      ])
    ),
  })),
})
