/**
 * Action Menu states based on the flow defined in RFC 0509.
 *
 * @see https://github.com/hyperledger/aries-rfcs/tree/main/features/0509-action-menu#states
 * @public
 */
export enum ActionMenuState {
  Null = 'null',
  AwaitingRootMenu = 'awaiting-root-menu',
  PreparingRootMenu = 'preparing-root-menu',
  PreparingSelection = 'preparing-selection',
  AwaitingSelection = 'awaiting-selection',
  Done = 'done',
}
