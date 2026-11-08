// App screenshots per language, made by scripts/capture-shots.mjs: assets/shots/<name>.<lang>.webp
const files = import.meta.glob<string>('./assets/shots/*.webp', { eager: true, import: 'default' })

export function shot(name: string, lang: string): string {
  const l = ['ru', 'uk'].includes(lang.slice(0, 2)) ? lang.slice(0, 2) : 'en'
  return files[`./assets/shots/${name}.${l}.webp`]
}
