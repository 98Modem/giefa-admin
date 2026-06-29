type Props = {
  title: string;
  value: string;
  detail?: string;
};

export function StatCard({ title, value, detail }: Props) {
  return (
    <div className="group relative min-h-36 overflow-hidden rounded-xl border bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md dark:bg-gray-900/80">
      <div className="absolute inset-x-0 top-0 h-1 bg-brand-500 opacity-80" />
      <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-brand-500/10 blur-2xl transition group-hover:bg-brand-500/20" />

      <p className="text-sm font-medium text-gray-500 dark:text-gray-300">
        {title}
      </p>
      <h3 className="mt-4 text-2xl font-bold leading-tight text-gray-950 dark:text-white sm:text-3xl">
        {value}
      </h3>
      {detail && (
        <p className="mt-3 text-xs font-medium text-gray-500 dark:text-gray-300">
          {detail}
        </p>
      )}
    </div>
  );
}
