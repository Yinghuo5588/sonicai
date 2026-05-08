export default function DataTableShell({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        {children}
      </div>
    </div>
  )
}
