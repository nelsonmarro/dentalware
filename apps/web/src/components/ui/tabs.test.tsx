import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs'

describe('TabsTrigger', () => {
  it('mide al menos 44 px de alto (min-h-11)', () => {
    render(
      <Tabs defaultValue="a">
        <TabsList>
          <TabsTrigger value="a">Nuevos</TabsTrigger>
          <TabsTrigger value="b">En curso</TabsTrigger>
        </TabsList>
        <TabsContent value="a">Contenido</TabsContent>
      </Tabs>,
    )
    expect(screen.getByRole('tab', { name: 'Nuevos' })).toHaveClass('min-h-11')
  })
})
