import { motion } from 'framer-motion'
import { SectionLabel } from './SectionLabel'
import { Pill } from './Pill'

type Props = {
  id?: string; label: string; title: string; description: string
  ctaLabel: string; ctaHref: string; steps: string[]; media: React.ReactNode; reverse?: boolean
}
export function SplitSection({ id, label, title, description, ctaLabel, ctaHref, steps, media, reverse }: Props) {
  return (
    <section id={id} className="py-20 md:py-28 px-6 md:px-10 max-w-6xl mx-auto">
      <div className={`grid gap-10 md:gap-14 items-center md:grid-cols-2 ${reverse ? 'md:[&>*:first-child]:order-2' : ''}`}>
        <motion.div
          initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }} transition={{ duration: 0.5 }}
          className="flex flex-col gap-5"
        >
          <SectionLabel>{label}</SectionLabel>
          <h2 className="font-serif text-3xl md:text-4xl text-white leading-tight">{title}</h2>
          <p className="text-white/60 max-w-md">{description}</p>
          <Pill href={ctaHref} variant="ghost" className="self-start">{ctaLabel}</Pill>
          <ul className="mt-4 flex flex-col divide-y divide-white/10 border-t border-white/10">
            {steps.map((s) => (
              <li key={s} className="py-3 text-sm text-white/70">{s}</li>
            ))}
          </ul>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }} transition={{ duration: 0.5, delay: 0.05 }}
        >
          {media}
        </motion.div>
      </div>
    </section>
  )
}
