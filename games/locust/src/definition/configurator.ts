import { BaseConfigurator, type GameConfigurator } from '@tabletop/common'
import { LocustGameConfig, LocustGameConfigOptions } from './config.js'

export class LocustConfigurator extends BaseConfigurator implements GameConfigurator {
    schema = LocustGameConfig
    options = LocustGameConfigOptions
}
