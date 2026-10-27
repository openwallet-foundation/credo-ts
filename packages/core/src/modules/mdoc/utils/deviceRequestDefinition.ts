import type {
  DeviceRequestInfoOptions,
  DeviceRequestMatchOptions,
  DocRequestInfo,
  DocRequestInfoOptions,
  UseCaseMatch,
} from '@owf/mdoc'
import { TypedArrayEncoder } from '../../../utils'
import type {
  MdocDcApiCreateVerificationSessionOptions,
  MdocDeviceRequestDefinition,
  MdocDeviceRequestInfo,
  MdocDocRequestInfo,
  MdocResolvedUseCase,
} from '../MdocOptions'

/**
 * Create the device request definition stored on a verification session from the doc requests a
 * verifier passed, with every requested element in its object form.
 *
 * Only what the device request cannot carry is stored. The request information and use cases are
 * sent in the device request, which is stored on the session as well and matched against as is.
 */
export const createDeviceRequestDefinition = ({
  docRequests,
  treatAmbiguousMultipleDocRequestsAsAlternatives,
}: Pick<
  MdocDcApiCreateVerificationSessionOptions,
  'docRequests' | 'treatAmbiguousMultipleDocRequestsAsAlternatives'
>): MdocDeviceRequestDefinition => ({
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

export const toDocRequestInfoOptions = (requestInfo: MdocDocRequestInfo): DocRequestInfoOptions => ({
  alternativeDataElements: requestInfo.alternativeDataElements,
  issuerIdentifiers: requestInfo.issuerIdentifiers?.map((issuerIdentifier) =>
    TypedArrayEncoder.fromHex(issuerIdentifier)
  ),
  uniqueDocSetRequired: requestInfo.uniqueDocSetRequired,
  maximumResponseSize: requestInfo.maximumResponseSize,
})

export const fromDocRequestInfo = (requestInfo: DocRequestInfo): MdocDocRequestInfo => ({
  alternativeDataElements: requestInfo.alternativeDataElements?.map(({ requestedElement, alternativeElementSets }) => ({
    requestedElement,
    alternativeElementSets,
  })),
  issuerIdentifiers: requestInfo.issuerIdentifiers?.map((issuerIdentifier) =>
    TypedArrayEncoder.toHex(issuerIdentifier)
  ),
  uniqueDocSetRequired: requestInfo.uniqueDocSetRequired,
  maximumResponseSize: requestInfo.maximumResponseSize,
})

export const toDeviceRequestInfoOptions = (deviceRequestInfo: MdocDeviceRequestInfo): DeviceRequestInfoOptions => ({
  useCases: deviceRequestInfo.useCases?.map(({ mandatory, documentSets, purposeHints }) => ({
    mandatory,
    documentSets,
    purposeHints: purposeHints ? new Map(Object.entries(purposeHints)) : undefined,
  })),
})

export const toResolvedUseCase = ({ purposeHints, ...useCase }: UseCaseMatch): MdocResolvedUseCase => ({
  ...useCase,
  purposeHints: purposeHints ? Object.fromEntries(purposeHints) : undefined,
})
