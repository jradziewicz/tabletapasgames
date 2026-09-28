import { BaseConfigurator, type GameConfigurator } from '@tabletop/common'
import { StellarVenturesGameConfig, StellarVenturesGameConfigOptions } from './config.js'

export class StellarVenturesConfigurator extends BaseConfigurator implements GameConfigurator {
    schema = StellarVenturesGameConfig
    options = StellarVenturesGameConfigOptions
}
