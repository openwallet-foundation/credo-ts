import { Transform, TransformationType } from 'class-transformer'

import { getLegacyIndySchemaId, getLegacyIndyCredentialDefinitionId } from '../../../../../core/src/utils'

export function CredentialDefinitionTransformer() {
  return Transform(({ value, type }) => {
    switch (type) {
      // go to qualified identifier
      case TransformationType.PLAIN_TO_CLASS:
        // transform done outside of class instance
        return value

      // go to unqualified identifier
      case TransformationType.CLASS_TO_PLAIN:
        value.id = getLegacyIndyCredentialDefinitionId(value.id)
        return value

      default:
        return value
    }
  })
}

export function SchemaTransformer() {
  return Transform(({ value, type }) => {
    switch (type) {
      // go to qualified identifier
      case TransformationType.PLAIN_TO_CLASS:
        // transform done outside of class instance
        return value

      // go to unqualified identifier
      case TransformationType.CLASS_TO_PLAIN:
        value.id = getLegacyIndySchemaId(value.id)
        return value

      default:
        return value
    }
  })
}
