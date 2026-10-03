import { describeStorageContract } from '../../lib/storage.contract.ts'
import { memoryStorage } from './fakes.ts'

// El fake de los tests de servicio cumple el mismo contrato que los drivers reales (#103):
// si divergiera, un test con fakes podría pasar con un comportamiento que el disco o la nube
// no tienen.
describeStorageContract('memoryStorage (fake)', async () => ({ storage: memoryStorage() }))
