import { useEffect, useRef, useState } from 'react'

/**
 * Un archivo elegido en el dispositivo y su URL de objeto, para mostrarlo antes de subirlo (la
 * miniatura de una foto). La URL se crea al elegir y se revoca al elegir otro o al desmontar:
 * ningún `createObjectURL` queda vivo (convención de imágenes). Se crea en el manejador y no en
 * un efecto, así el doble montaje de `StrictMode` no revoca una URL que se sigue mostrando.
 */
export function useLocalFile() {
  const [chosen, setChosen] = useState<{ file: File; url: string } | null>(null)
  const live = useRef<string | null>(null)

  useEffect(() => {
    const urls = live
    return () => {
      if (urls.current) URL.revokeObjectURL(urls.current)
    }
  }, [])

  function choose(file: File) {
    if (live.current) URL.revokeObjectURL(live.current)
    const url = URL.createObjectURL(file)
    live.current = url
    setChosen({ file, url })
  }

  return { file: chosen?.file ?? null, url: chosen?.url ?? null, choose }
}
