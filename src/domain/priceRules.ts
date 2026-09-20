// 调价规则层：纯函数，不依赖存储与页面，负责价差计算、登记校验、状态流转与异常扫描。

export type AdjustmentStatus = "draft" | "pending" | "effective" | "withdrawn";

export const STATUS_LABELS: Record<AdjustmentStatus, string> = {
  draft: "草稿",
  pending: "待生效",
  effective: "生效中",
  withdrawn: "已撤回",
};

/** 偏离指导价上限（元），超过即须填写依据并指定复核人 */
export const DEVIATION_LIMIT = 0.3;

const EPSILON = 1e-9;

export interface HistoryEntry {
  at: string;
  action: string;
  actor: string;
  detail: string;
}

export interface PriceAdjustment {
  id: string;
  station: string;
  region: string;
  fuel: string;
  price: number;
  guidePrice: number;
  applicant: string;
  effectiveDate: string;
  basis: string;
  reviewer: string;
  status: AdjustmentStatus;
  createdAt: string;
  history: HistoryEntry[];
}

export interface AdjustmentInput {
  station: string;
  fuel: string;
  price: number;
  guidePrice: number;
  applicant: string;
  effectiveDate: string;
  basis: string;
  reviewer: string;
}

export interface RuleException {
  station: string;
  fuel: string;
  effectiveDate: string;
  reason: string;
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function deviationOf(price: number, guidePrice: number): number {
  return roundMoney(price - guidePrice);
}

export function formatDeviation(price: number, guidePrice: number): string {
  const diff = deviationOf(price, guidePrice);
  return `${diff > 0 ? "+" : ""}${diff.toFixed(2)}`;
}

/** 偏离指导价超过三角钱（严格大于 0.30 元） */
export function exceedsDeviation(price: number, guidePrice: number): boolean {
  return Math.abs(deviationOf(price, guidePrice)) > DEVIATION_LIMIT + EPSILON;
}

/** 同站同油品的待生效记录（不变量：至多一笔） */
export function pendingOf(
  records: PriceAdjustment[],
  station: string,
  fuel: string,
  excludeId = ""
): PriceAdjustment | undefined {
  return records.find(
    (record) =>
      record.status === "pending" &&
      record.station === station &&
      record.fuel === fuel &&
      record.id !== excludeId
  );
}

/** 登记校验：不满足生效条件的只能存草稿 */
export function evaluateSubmission(
  input: AdjustmentInput,
  records: PriceAdjustment[],
  excludeId = ""
): { status: "pending" | "draft"; exceptions: RuleException[] } {
  const exceptions: RuleException[] = [];
  const target = {
    station: input.station || "未选择站点",
    fuel: input.fuel || "未选择油品",
    effectiveDate: input.effectiveDate || "未填写日期",
  };
  if (!input.station || !input.fuel || !input.applicant.trim() || !input.effectiveDate || !(input.price > 0)) {
    exceptions.push({ ...target, reason: "站点、油品、挂牌价、申请人、生效日期均为必填项" });
  }
  if (input.station && input.fuel && pendingOf(records, input.station, input.fuel, excludeId)) {
    exceptions.push({ ...target, reason: "同站同油品已存在待生效记录，须先撤回再登记" });
  }
  if (exceedsDeviation(input.price, input.guidePrice) && (!input.basis.trim() || !input.reviewer.trim())) {
    exceptions.push({
      ...target,
      reason: `偏离指导价超过 ${DEVIATION_LIMIT.toFixed(2)} 元，须填写调价依据并指定复核人`,
    });
  }
  return { status: exceptions.length > 0 ? "draft" : "pending", exceptions };
}

/** 仅待生效记录可审批；超价差缺依据或复核人的不允许通过 */
export function canApprove(record: PriceAdjustment): boolean {
  if (record.status !== "pending") return false;
  return !(
    exceedsDeviation(record.price, record.guidePrice) &&
    (!record.basis.trim() || !record.reviewer.trim())
  );
}

/** 仅未生效记录（待生效/草稿）可撤回；生效后金额冻结不可撤回 */
export function canWithdraw(record: PriceAdjustment): boolean {
  return record.status === "pending" || record.status === "draft";
}

/** 当前挂牌价：最近一笔生效记录的价格，没有则返回 null（页面显示未定价） */
export function currentPriceOf(records: PriceAdjustment[], station: string, fuel: string): number | null {
  const effective = records
    .filter((record) => record.status === "effective" && record.station === station && record.fuel === fuel)
    .sort((a, b) => `${b.effectiveDate}${b.createdAt}`.localeCompare(`${a.effectiveDate}${a.createdAt}`));
  return effective.length > 0 ? effective[0].price : null;
}

/** 扫描存量记录得出异常清单（刷新后由存储数据重新推导，保证一致） */
export function collectExceptions(records: PriceAdjustment[]): RuleException[] {
  const exceptions: RuleException[] = [];
  const seen = new Map<string, PriceAdjustment>();
  for (const record of records.filter((item) => item.status === "pending")) {
    const key = `${record.station}::${record.fuel}`;
    const first = seen.get(key);
    if (first) {
      exceptions.push({
        station: record.station,
        fuel: record.fuel,
        effectiveDate: record.effectiveDate,
        reason: `与生效日 ${first.effectiveDate} 的待生效记录冲突，同站同油品只能保留一笔`,
      });
    } else {
      seen.set(key, record);
    }
  }
  for (const record of records) {
    if (record.status === "withdrawn") continue;
    if (exceedsDeviation(record.price, record.guidePrice) && (!record.basis.trim() || !record.reviewer.trim())) {
      exceptions.push({
        station: record.station,
        fuel: record.fuel,
        effectiveDate: record.effectiveDate,
        reason:
          record.status === "draft"
            ? `价差 ${formatDeviation(record.price, record.guidePrice)} 元超出 ±${DEVIATION_LIMIT.toFixed(2)} 元，须补调价依据并指定复核人后才能提交`
            : `价差 ${formatDeviation(record.price, record.guidePrice)} 元超出 ±${DEVIATION_LIMIT.toFixed(2)} 元，但缺少调价依据或复核人`,
      });
    }
  }
  return exceptions;
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
