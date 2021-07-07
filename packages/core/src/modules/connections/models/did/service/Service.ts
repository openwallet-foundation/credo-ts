import { IsString } from 'class-validator'

export class Service {
  public constructor(options: { id: string; serviceEndpoint: string; type: string }) {
    if (options) {
      this.id = options.id
      this.serviceEndpoint = options.serviceEndpoint
      this.type = options.type
    }
  }

  @IsString()
  public id!: string

  @IsString()
  public serviceEndpoint!: string

  @IsString()
  public type!: string
}
