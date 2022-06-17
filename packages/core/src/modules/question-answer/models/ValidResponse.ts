export class ValidResponse {
  public constructor(options: ValidResponse) {
    if (options) {
      this.text = options.text
    }
  }

  public text!: string
}
