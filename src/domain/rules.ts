/**
 * 业务规则层：纯函数，不依赖 Vue / localStorage，便于单测与复用。
 * 覆盖：价差计算、审批要素校验、在途唯一性、状态流转、撤回后价格恢复。
 */
import {
  DEVIATION_LIMIT_YUAN,
  PENDING_STATUSES,
  type Fuel,
  type GuidePrice,
  type PriceRecord,
  type RecordStatus,
  type RegisterInput,
} from "./types";

/** 元转分，避免浮点误差（价差阈值判断一律以分为单位） */
export function toCents(yuan: number): number {
  return Math.round(yuan * 100);
}

/** 价差（元，两位小数）：申请价 - 指导价 */
export function priceDiff(price: number, guidePrice: number): number {
  return (toCents(price) - toCents(guidePrice)) / 100;
}

/** 偏离指导价是否超过三角钱（严格大于 0.30 元） */
export function exceedsDeviation(price: number, guidePrice: number): boolean {
  return Math.abs(toCents(price) - toCents(guidePrice)) > toCents(DEVIATION_LIMIT_YUAN);
}

export function isPendingStatus(status: RecordStatus): boolean {
  return PENDING_STATUSES.includes(status);
}

/** 生效后金额冻结：不可改价、不可撤回 */
export function isFrozen(record: PriceRecord): boolean {
  return record.status === "生效中";
}

/** 仅未生效记录可撤回（改价先撤回未生效记录） */
export function canWithdraw(record: PriceRecord): boolean {
  return isPendingStatus(record.status);
}

export function canSubmitDraft(record: PriceRecord): boolean {
  return record.status === "草稿";
}

export function canApprove(record: PriceRecord): boolean {
  return record.status === "待复核";
}

/** 生效日到达的待生效记录可转为生效中 */
export function dueForActivation(record: PriceRecord, today: string): boolean {
  return record.status === "待生效" && record.effectiveDate <= today;
}

/** 区域指导价查询：站区联动，站点所属区域 + 油品定位指导价 */
export function findGuidePrice(
  guidePrices: GuidePrice[],
  region: string,
  fuel: Fuel,
): GuidePrice | undefined {
  return guidePrices.find((item) => item.region === region && item.fuel === fuel);
}

/**
 * 同站同油品的在途（未生效）记录。
 * 规则：同站同油品只能保留一笔待生效记录，改价须先撤回在途记录。
 */
export function findPendingRecord(
  records: PriceRecord[],
  stationId: string,
  fuel: Fuel,
  excludeId?: string,
): PriceRecord | undefined {
  return records.find(
    (record) =>
      record.stationId === stationId &&
      record.fuel === fuel &&
      record.id !== excludeId &&
      isPendingStatus(record.status),
  );
}

/** 登记入参的基础校验，返回错误文案列表（空数组表示通过） */
export function validateRegisterInput(input: RegisterInput): string[] {
  const errors: string[] = [];
  if (!input.stationId) errors.push("请选择站点");
  if (!input.fuel) errors.push("请选择油品");
  if (!Number.isFinite(input.price) || input.price <= 0) errors.push("申请价必须大于 0 元");
  if (!input.applicant.trim()) errors.push("请填写申请人");
  if (!input.effectiveDate) errors.push("请选择生效日");
  return errors;
}

export type SubmitDecision =
  | { kind: "direct"; status: "待生效" }
  | { kind: "review"; status: "待复核" }
  | { kind: "draftOnly"; status: "草稿"; missing: string[] };

/**
 * 提交审批时的去向判定：
 * - 偏离 ≤ 0.3 元：直接待生效；
 * - 偏离 > 0.3 元：须填写依据并指定复核人 → 待复核；
 * - 偏离 > 0.3 元但要素缺失：只能存草稿。
 */
export function decideSubmit(
  price: number,
  guidePrice: number,
  reason: string,
  reviewer: string,
): SubmitDecision {
  if (!exceedsDeviation(price, guidePrice)) return { kind: "direct", status: "待生效" };
  const missing: string[] = [];
  if (!reason.trim()) missing.push("偏离依据");
  if (!reviewer.trim()) missing.push("复核人");
  if (missing.length > 0) return { kind: "draftOnly", status: "草稿", missing };
  return { kind: "review", status: "待复核" };
}

export interface CurrentPrice {
  record: PriceRecord | null;
  /** null 表示未定价 */
  price: number | null;
}

/**
 * 站点当前有效价：最近一笔生效中记录的价格。
 * 撤回在途记录后看板即恢复为该价格；没有生效记录则未定价。
 */
export function resolveCurrentPrice(
  records: PriceRecord[],
  stationId: string,
  fuel: Fuel,
): CurrentPrice {
  const effective = records
    .filter(
      (record) =>
        record.stationId === stationId && record.fuel === fuel && record.status === "生效中",
    )
    .sort(
      (a, b) =>
        b.effectiveDate.localeCompare(a.effectiveDate) || b.createdAt.localeCompare(a.createdAt),
    );
  const top = effective[0] ?? null;
  return { record: top, price: top ? top.price : null };
}

/** 撤回后的恢复文案：恢复最近有效价格，没有则未定价 */
export function restoreTextAfterWithdraw(records: PriceRecord[], stationId: string, fuel: Fuel): string {
  const current = resolveCurrentPrice(records, stationId, fuel);
  return current.price === null ? "恢复为未定价" : `恢复最近有效价格 ${current.price.toFixed(2)} 元`;
}

/** 本地日期 YYYY-MM-DD（不用 toISOString，避免时区偏移） */
export function todayStr(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** 价差展示：带符号、两位小数 */
export function formatDiff(diff: number): string {
  return `${diff > 0 ? "+" : ""}${diff.toFixed(2)}`;
}
