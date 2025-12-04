export interface SdJwtVcTypeMetadataClaim {
  path: Array<string | null>

  /**
   * A boolean indicating that the claim must be present in the issued credential.
   * This property is OPTIONAL. If omitted, the default value is false
   */
  mandatory?: boolean

  display?: Array<{
    /**
     * @deprecated `locale` should be used
     */
    lang?: string
    locale?: string
    label: string
    description?: string
  }>
  /**
   * @default allowed
   */
  sd?: 'allowed' | 'always' | 'never'
  svg_id?: string
}

export interface SdJwtVcTypeMetadataRenderingMethodSimple {
  logo?: {
    uri: string
    'uri#integrity'?: string
    alt_text?: string
  }
  background_color?: string
  background_image?: string
  text_color?: string
}

export interface SdJwtVcTypeMetadataRenderingMethodSvgTemplate {
  uri: string
  'uri#integrity'?: string
  properties?: {
    orientation?: 'portrait' | 'landscape'
    color_scheme?: 'light' | 'dark'
    contrast?: 'normal' | 'high'
  }
}

export interface SdJwtVcTypeMetadataDisplay {
  /**
   * @deprecated `locale` should be used
   */
  lang?: string

  locale?: string
  name: string
  description?: string
  rendering?: {
    simple?: SdJwtVcTypeMetadataRenderingMethodSimple
    svg_templates?: SdJwtVcTypeMetadataRenderingMethodSvgTemplate[]
    [key: string]: unknown
  }
}

export interface SdJwtVcTypeMetadata {
  vct: string
  name?: string
  description?: string

  extends?: string
  'extends#integrity'?: string

  display?: SdJwtVcTypeMetadataDisplay[]
  claims?: SdJwtVcTypeMetadataClaim[]

  schema?: object
  schema_uri?: string
  'schema_uri#integrity'?: string
}
