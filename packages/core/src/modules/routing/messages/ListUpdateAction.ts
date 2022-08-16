export enum ListUpdateAction {
  add = 'add',
  remove = 'remove',
}

export enum ListUpdateResult {
  ClientError = 'client_error',
  ServerError = 'server_error',
  NoChange = 'no_change',
  Success = 'success',
}
