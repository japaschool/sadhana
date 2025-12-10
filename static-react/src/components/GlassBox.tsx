export default function GlassBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-black/40 backdrop-blur-md rounded-2xl p-6 border border-white/10 text-white">
      {children}
    </div>
  )
}
