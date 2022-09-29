import type { DidDocument, DidType, DidConnectivity } from '../domain'

interface DIDInformationProps {
  did: string
  didDocument?: DidDocument | null
  didType?: DidType
  label?: string
  logoUrl?: string
  connectivity?: DidConnectivity
}

export class DIDInformation {
  public did!: string
  public didType?: DidType
  public didDocument?: DidDocument | null
  public label?: string
  public logoUrl?: string
  public connectivity?: DidConnectivity

  public constructor(props: DIDInformationProps) {
    if (props) {
      this.did = props.did
      this.didType = props.didType
      this.didDocument = props.didDocument
      this.label = props.label
      this.logoUrl = props.logoUrl
      this.connectivity = props.connectivity
    }
  }
}
