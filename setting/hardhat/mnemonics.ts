import * as process from 'process'

import { getMnemonics } from './utils'

export const hardhatMnemonics = {
    ...getMnemonics(process.env.STAGE ?? 'sandbox'),
}
