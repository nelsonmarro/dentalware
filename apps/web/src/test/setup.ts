import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import { setMatchMedia } from './match-media'

setMatchMedia(true) // escritorio por defecto
afterEach(() => cleanup())
