export enum Color {
  Green = '\x1b[32m',
  Red = '\x1b[31m',
  Purple = '\x1b[35m',
  Reset = '\x1b[0m',
}

export enum Output {
  NoConnectionRecordFromOutOfBand = '\nNo connectionRecord has been created from invitation\n',
  ConnectionEstablished = '\nConnection established!',
  MissingConnectionRecord = '\nNo connectionRecord ID has been set yet\n',
  ConnectionLink = `\nRun 'Receive connection invitation' in Alice and paste this invitation link:\n\n`,
  Exit = 'Shutting down agent...\nExiting...',
}

export enum Title {
  OptionsTitle = '\nOptions:',
  InvitationTitle = '\n\nPaste the invitation url here:',
  MessageTitle = '\n\nWrite your message here:\n(Press enter to send or press q to exit)\n',
  ConfirmTitle = '\n\nAre you sure?',
  CredentialOfferTitle = '\n\nCredential offer received, do you want to accept it?',
  ProofRequestTitle = '\n\nProof request received, do you want to accept it?',
}

export const greenText = (text: string, reset?: boolean) => {
  if (reset) return Color.Green + text + Color.Reset

  return Color.Green + text
}

export const purpleText = (text: string, reset?: boolean) => {
  if (reset) return Color.Purple + text + Color.Reset
  return Color.Purple + text
}

export const redText = (text: string, reset?: boolean) => {
  if (reset) return Color.Red + text + Color.Reset

  return Color.Red + text
}
