// App screenshots per language, made by scripts/capture-shots.mjs: assets/shots/<name>.<lang>.webp
const files = import.meta.glob<string>('./assets/shots/*.webp', { eager: true, import: 'default' })

// Phone walk-through per language, made by scripts/capture-video.mjs: assets/demo/walkthrough.<lang>.webm
const videos = import.meta.glob<string>('./assets/demo/*.webm', { eager: true, import: 'default' })

export function walkthrough(lang: string): string {
  const l = ['ru', 'uk'].includes(lang.slice(0, 2)) ? lang.slice(0, 2) : 'en'
  return videos[`./assets/demo/walkthrough.${l}.webm`]
}

export function shot(name: string, lang: string): string {
  const l = ['ru', 'uk'].includes(lang.slice(0, 2)) ? lang.slice(0, 2) : 'en'
  return files[`./assets/shots/${name}.${l}.webp`]
}
