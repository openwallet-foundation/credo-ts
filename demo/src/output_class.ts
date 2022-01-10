export enum Color {
    green = `\x1b[32m`,
    reset = `\x1b[0m`,
    red = `\x1b[31m`,
}


export enum Output {
    connectionEstablished = `\nConnection established!\n`,
    missingConnectionRecord = `\nNo connectionRecord ID has been set yet. DID YOU FORGET TO CALL .....\n`,
}

export enum Title {
    optionsTitle = 'Options:',
    invitationTitle = 'Paste the invitation url here:',
    messageTitle = 'Write your message here:\nPress q to exit',
    confirmTitle = 'Are you sure?',
    credentialOfferTitle = 'Credential offer received, do you want to accept it?',
    proofProposalTitle = 'Proof proposal received, do you want to accept it?'
}