import { BaseConfigurator, type GameConfigurator } from '@tabletop/common'
import { RockyVenturesGameConfig, RockyVenturesGameConfigOptions } from './config.js'

export class RockyVenturesConfigurator extends BaseConfigurator implements GameConfigurator {
    schema = RockyVenturesGameConfig
    options = RockyVenturesGameConfigOptions
}
