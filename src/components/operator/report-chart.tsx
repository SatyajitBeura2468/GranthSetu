export function CirculationChart({ values }: { values: number[] }) {
  const max = Math.max(...values, 1); const points = values.map((value, index) => `${(index / Math.max(values.length - 1, 1)) * 100},${64 - (value / max) * 56}`).join(" ");
  return <div className="chart"><svg viewBox="0 0 100 68" preserveAspectRatio="none" role="img" aria-label={`Circulation across ${values.length} periods. Values: ${values.join(", ")}`}><path d="M0 64H100" className="chart-axis" /><polyline points={points} className="chart-line" /></svg><div className="chart-labels"><span>Period 1</span><span>Period {values.length}</span></div></div>;
}

export function CategoryBars({ values }: { values: Array<{ label: string; value: number }> }) { const max = Math.max(...values.map((item) => item.value), 1); return <div className="category-bars">{values.map((item) => <div key={item.label}><span>{item.label}</span><div><i style={{ width: `${(item.value / max) * 100}%` }} /></div><strong>{item.value}%</strong></div>)}</div>; }
