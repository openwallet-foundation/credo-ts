import type { InputDescriptorV2 } from '@sphereon/pex-models'
import type { MdocDocumentRequest } from '../../mdoc'
import { DifPresentationExchangeError } from '../DifPresentationExchangeError'
import type { DifPresentationExchangeDefinitionV2 } from '../models'

const parsePath = (
  path: string
): {
  namespace: string
  elementIdentifier: string
} => {
  /**
   * path looks like this: "$['org.iso.18013.5.1']['family_name']"
   * the regex creates two groups with contents between "['" and "']"
   * the second entry in each group contains the result without the "'[" or "']"
   *
   * @example org.iso.18013.5.1 family_name
   */
  const matches = [...path.matchAll(/\['(.*?)'\]/g)]
  if (matches.length !== 2) {
    throw new Error(`Invalid path format: "${path}"`)
  }

  const [namespaceMatch, elementIdentifierMatch] = matches
  const namespace = namespaceMatch?.[1]
  const elementIdentifier = elementIdentifierMatch?.[1]

  if (!namespace || !elementIdentifier) {
    throw new Error(`Failed to parse path: "${path}"`)
  }

  return { namespace, elementIdentifier }
}

export function inputDescriptorToDocumentRequest(inputDescriptor: InputDescriptorV2): MdocDocumentRequest {
  return {
    docType: inputDescriptor.id,
    nameSpaces:
      inputDescriptor.constraints.fields?.reduce(
        (namespaces, field) => {
          // Only take first path into account
          const { namespace, elementIdentifier } = parsePath(field.path[0])

          if (!namespaces[namespace]) {
            namespaces[namespace] = {}
          }

          namespaces[namespace][elementIdentifier] = field.intent_to_retain ?? false

          return namespaces
        },
        {} as Record<string, Record<string, boolean>>
      ) ?? {},
  }
}

export function assertMdocInputDescriptor(inputDescriptor: InputDescriptorV2) {
  if (!inputDescriptor.format || !inputDescriptor.format.mso_mdoc) {
    throw new DifPresentationExchangeError(`Input descriptor must contain 'mso_mdoc' format property`)
  }

  if (!inputDescriptor.format.mso_mdoc.alg) {
    throw new DifPresentationExchangeError(`Input descriptor mso_mdoc must contain 'alg' property`)
  }

  if (!inputDescriptor.constraints?.limit_disclosure || inputDescriptor.constraints.limit_disclosure !== 'required') {
    throw new DifPresentationExchangeError(
      `Input descriptor must contain 'limit_disclosure' constraints property which is set to required`
    )
  }

  if (!inputDescriptor.constraints?.fields?.every((field) => field.intent_to_retain !== undefined)) {
    throw new DifPresentationExchangeError(`Input descriptor must contain 'intent_to_retain' constraints property`)
  }

  return {
    ...inputDescriptor,
    format: {
      mso_mdoc: inputDescriptor.format.mso_mdoc,
    },
    constraints: {
      ...inputDescriptor.constraints,
      limit_disclosure: 'required',
      fields: (inputDescriptor.constraints.fields ?? []).map((field) => {
        return {
          ...field,
          intent_to_retain: field.intent_to_retain ?? false,
        }
      }),
    },
  } satisfies DifPresentationExchangeDefinitionV2['input_descriptors'][number]
}
