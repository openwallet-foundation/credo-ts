interface DidMetaProps {
  did: string
  label?: string
  logoUrl?: string
}

export class DidInfo {
  public did!: string
  public label?: string
  public logoUrl?: string

  public constructor(props: DidMetaProps) {
    if (props) {
      this.did = props.did
      this.label = props.label
      this.logoUrl = props.logoUrl
    }
  }
}
