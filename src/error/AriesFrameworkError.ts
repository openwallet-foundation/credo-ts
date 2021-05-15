export class AriesFrameworkError extends Error {
  public cause?: Error

  /**
   * Create base AriesFrameworkError.
   * @param message the error message
   * @param options the error options
   * @param options.cause the error that caused this error to be created
   * @param options.constructorOpt a function above which all frames, including constructorOpt, will be omitted from the generated stack trace.
   *
   * @see "https://nodejs.org/api/errors.html#errors_error_capturestacktrace_targetobject_constructoropt"
   */
  // eslint-disable-next-line @typescript-eslint/ban-types
  public constructor(message: string, { cause, constructorOpt }: { cause?: Error; constructorOpt?: Function } = {}) {
    super(message)
    this.cause = cause
    Error.captureStackTrace(this, constructorOpt ?? this.constructor)
  }
}
