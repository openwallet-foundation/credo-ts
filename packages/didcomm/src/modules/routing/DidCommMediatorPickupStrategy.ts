export enum DidCommMediatorPickupStrategy {
  // Use PickUp v1 protocol to periodically retrieve messages
  PickUpV1 = 'PickUpV1',

  // Use PickUp v2 protocol to periodically retrieve messages
  PickUpV2 = 'PickUpV2',

  // Use PickUp v2 protocol in Live Mode to get incoming messages as soon as they arrive
  // to mediator
  PickUpV2LiveMode = 'PickUpV2LiveMode',

  // Use PickUp v3 protocol to periodically retrieve messages (for Coordinate Mediation 2.0)
  PickUpV3 = 'PickUpV3',

  // Use PickUp v3 protocol in Live Mode (for Coordinate Mediation 2.0)
  PickUpV3LiveMode = 'PickUpV3LiveMode',

  // Implicit pickup strategy means picking up messages only using return route
  // decorator. This is what ACA-Py currently uses
  Implicit = 'Implicit',

  // Do not pick up messages
  None = 'None',
}
