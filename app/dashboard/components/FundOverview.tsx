import { Role } from "@/app/employee_type/roles";
import { isTopManagement } from "../config/fundVisibility";

type Props = {
  role: Role;
  emergencyFund: number;
  investmentFund: number;
  personalEmergency: number;
  personalInvestment: number;
};

function money(value: number) {
  return `UGX ${Number(value ?? 0).toLocaleString()}`;
}

export function FundOverview({
  role,
  emergencyFund,
  investmentFund,
  personalEmergency,
  personalInvestment,
}: Props) {
  const management = isTopManagement(role);
  const funds = management
    ? [
        {
          label: "Emergency reserve",
          value: emergencyFund,
          percent: ratio(emergencyFund, emergencyFund + investmentFund),
          detail: "Association liquidity",
        },
        {
          label: "Investment pool",
          value: investmentFund,
          percent: ratio(investmentFund, emergencyFund + investmentFund),
          detail: "Growth capital",
        },
      ]
    : [
        {
          label: "My emergency balance",
          value: personalEmergency,
          percent: ratio(personalEmergency, personalEmergency + personalInvestment),
          detail: "Personal safety balance",
        },
        {
          label: "My investment value",
          value: personalInvestment,
          percent: ratio(personalInvestment, personalEmergency + personalInvestment),
          detail: "Personal growth balance",
        },
      ];

  return (
    <div className="h-full min-h-[18rem] rounded-xl border bg-white p-5 shadow-sm dark:bg-gray-900/80 sm:p-6">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-300">
            {management ? "Treasury position" : "My fund position"}
          </p>
          <h3 className="mt-1 text-lg font-semibold text-gray-950 dark:text-white">
            Fund Breakdown
          </h3>
        </div>
        <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-200">
          {management ? "Managed" : "Private"}
        </span>
      </div>

      <div className="space-y-5">
        {funds.map((fund) => (
          <div key={fund.label}>
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-300">
                  {fund.label}
                </p>
                <p className="mt-1 text-xl font-semibold text-gray-950 dark:text-white">
                  {money(fund.value)}
                </p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-300">
                  {fund.detail}
                </p>
              </div>
              <p className="text-sm font-semibold text-brand-600 dark:text-brand-300">
                {fund.percent}%
              </p>
            </div>

            <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
              <div
                className="h-full rounded-full bg-brand-500"
                style={{ width: `${fund.percent}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ratio(value: number, total: number) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}
