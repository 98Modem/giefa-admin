type Props = {
  current: number;
  previous: number;
};

export function GrowthDelta({ current, previous }: Props) {
  if (!previous) return null;

  const diff = current - previous;
  const percent = ((diff / previous) * 100).toFixed(1);
  const positive = diff >= 0;

  return (
    <div
      className={`mt-2 text-sm font-medium ${
        positive ? "text-green-600" : "text-red-600"
      }`}
    >
      {positive ? "▲" : "▼"} {percent}% vs last month
    </div>
  );
}
