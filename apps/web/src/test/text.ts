/**
 * Matcher de Testing Library para un párrafo cuyo texto completo es `text`, aunque esté partido
 * en varios elementos (los montos van en su `<span className="font-mono">`).
 */
export const paragraph = (text: string) => (_content: string, element: Element | null) =>
  element?.tagName === 'P' && element.textContent === text
