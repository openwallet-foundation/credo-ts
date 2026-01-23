import type { TypeMetadataFormat } from '@sd-jwt/sd-jwt-vc'

export type SdJwtVcTypeMetadataClaim = NonNullable<TypeMetadataFormat['claims']>[number]
export type SdJwtVcTypeMetadataRenderingMethodSimple = NonNullable<
  NonNullable<TypeMetadataFormat['display']>[number]['rendering']
>['simple']
export type SdJwtVcTypeMetadataRenderingMethodSvgTemplate = NonNullable<
  NonNullable<NonNullable<TypeMetadataFormat['display']>[number]['rendering']>['svg_templates']
>

export type SdJwtVcTypeMetadataDisplay = NonNullable<TypeMetadataFormat['display']>[number]

export type SdJwtVcTypeMetadata = TypeMetadataFormat
