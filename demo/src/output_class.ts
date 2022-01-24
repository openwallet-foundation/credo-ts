export enum Color {
  green = `\x1b[32m`,
  red = `\x1b[31m`,
  purlpe = `\x1b[35m`,
  reset = `\x1b[0m`,
}

export enum Output {
  connectionEstablished = `\nConnection established!`,
  missingConnectionRecord = `\nNo connectionRecord ID has been set yet\n`,
  connectionLink = `\nRun 'setup connection' in Faber and paste this invitation link:\n\n`,
  exit = 'Shutting down agent...\nExiting...',
}

export enum Title {
  optionsTitle = '\nOptions:',
  invitationTitle = '\n\nPaste the invitation url here:',
  messageTitle = '\n\nWrite your message here:\n(Press enter to send or press q to exit)\n',
  confirmTitle = '\n\nAre you sure?',
  credentialOfferTitle = '\n\nCredential offer received, do you want to accept it?',
  proofRequestTitle = '\n\nProof request received, do you want to accept it?',
}
