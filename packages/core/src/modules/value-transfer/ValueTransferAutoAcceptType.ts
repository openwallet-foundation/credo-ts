/**
 * Typing of the state for auto acceptance
 */
export enum AutoAcceptValueTransfer {
  // Always auto accepts the proof no matter if it changed in subsequent steps
  Always = 'always',

  // DEFAULT: Never auto accept a value transfer
  Never = 'never',
}
