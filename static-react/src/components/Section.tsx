export default function Section({ title, text }: { title: string; text: string }) {
  return (
    <section className="bg-white text-gray-800 py-24 px-8 md:px-20 text-center">
      <h2 className="text-3xl md:text-5xl font-serif mb-6">{title}</h2>
      <p className="max-w-3xl mx-auto text-lg md:text-xl leading-relaxed">{text}</p>
    </section>
  )
}
