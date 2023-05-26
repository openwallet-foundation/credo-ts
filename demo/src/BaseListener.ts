import type BottomBar from 'inquirer/lib/ui/bottom-bar'

import { ui } from 'inquirer'

export class BaseListener {
  public on: boolean
  protected ui: BottomBar

  public constructor() {
    this.on = false
    this.ui = new ui.BottomBar()
  }

  protected turnListenerOn() {
    this.on = true
  }

  protected turnListenerOff() {
    this.on = false
  }
}
