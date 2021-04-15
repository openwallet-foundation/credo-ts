export enum RequestMediationType {
    // TODO: add other messages from mediator coordination protocol
    KeylistUpdate = 'https://didcomm.org/coordinatemediation/1.0/keylist_update',
    BatchPickup = 'https://didcomm.org/messagepickup/1.0/batch-pickup',
    Batch = 'https://didcomm.org/messagepickup/1.0/batch',
    ForwardMessage = 'https://didcomm.org/routing/1.0/forward',
  }

//   I should keep this separate from other aspects of AFJ for the time being. Not interfere with the other types, 
//   even though it'll mean that this enum is pretty empty.