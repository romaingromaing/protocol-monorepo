import { Chain, Stage } from './enums'

export type Network = `${Chain}-${Stage}${'-local' | ''}`
