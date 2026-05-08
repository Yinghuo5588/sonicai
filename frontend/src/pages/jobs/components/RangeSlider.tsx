// frontend/src/pages/jobs/components/RangeSlider.tsx

export default function RangeSlider({
  label,
  value,
  onChange,
  min = 50,
  max = 95,
}: {
  label: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
        <span>{label}</span>
        <span className="font-medium text-cyan-600 dark:text-cyan-300">{value}%</span>
      </div>
      <input
        type="range" min={min} max={max} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="h-2 w-full rounded-lg bg-slate-200 accent-cyan-500 dark:bg-slate-700"
      />
    </div>
  )
}