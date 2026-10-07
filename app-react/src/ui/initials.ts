/** Up to two capital initials from a display name, or `?` when it's blank. */
export function initials(name: string) {
  const letters = name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('')
  return letters || '?'
}
