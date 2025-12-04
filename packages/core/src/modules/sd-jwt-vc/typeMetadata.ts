export interface SdJwtVcTypeMetadataClaim {
  path: Array<string | null>
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
