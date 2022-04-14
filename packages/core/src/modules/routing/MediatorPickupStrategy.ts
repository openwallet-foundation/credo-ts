export enum MediatorPickupStrategy {
  // Explicit pickup strategy means picking up messages using the pickup protocol
  Explicit = 'Explicit',

  // Supports pickup v2
  PickUpV2 = 'PickUpV2',

  // Implicit pickup strategy means picking up messages only using return route
  // decorator. This is what ACA-Py currently uses
  Implicit = 'Implicit',

  // Do not pick up messages
  None = 'None',
}
