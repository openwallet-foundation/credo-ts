export enum Color {
    green = `\x1b[32m`,
    reset = `\x1b[0m`,
    red = `\x1b[31m`,
}


export enum Output {
    connectionEstablished = `\nConnection established!\n`,
    missingConnectionRecord = `\nNo connectionRecord ID has been set yet. DID YOU FORGET TO CALL .....\n`,
}