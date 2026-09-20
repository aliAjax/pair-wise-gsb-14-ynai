// 存储层：调价记录的 localStorage 读写与种子数据，页面与规则不直接操作存储细节。

import type { AdjustmentStatus, PriceAdjustment } from "../domain/priceRules";

const STORAGE_KEY = "dfwlfront-9-price-adjustments";

const STATUSES: AdjustmentStatus[] = ["draft", "pending", "effective", "withdrawn"];

function daysAgo(days: number, hour = 9): string {
  const date = new Date(Date.now() - days * 86400000);
  date.setHours(hour, 30, 0, 0);
  return date.toISOString();
}

function seed(): PriceAdjustment[] {
  return [
    {
      id: "seed-pending-1",
      station: "滨江路加油站",
      region: "华东一区",
      fuel: "柴油",
      price: 7.82,
      guidePrice: 7.48,
      applicant: "赵磊",
      effectiveDate: "2026-09-25",
      basis: "周边三座竞品站集中上调柴油 0.30 元以上，跟涨以保持合理价差",
      reviewer: "李敏",
      status: "pending",
      createdAt: daysAgo(1),
      history: [
        { at: daysAgo(1), action: "登记待生效", actor: "赵磊", detail: "申请价 7.82 元，指导价 7.48 元，价差 +0.34 元" },
      ],
    },
    {
      id: "seed-draft-1",
      station: "高新区加油站",
      region: "华东二区",
      fuel: "95号汽油",
      price: 8.04,
      guidePrice: 8.39,
      applicant: "孙倩",
      effectiveDate: "2026-09-22",
      basis: "",
      reviewer: "",
      status: "draft",
      createdAt: daysAgo(2),
      history: [
        { at: daysAgo(2), action: "保存草稿", actor: "孙倩", detail: "价差 -0.35 元超出 ±0.30 元，待补调价依据与复核人" },
      ],
    },
    {
      id: "seed-effective-1",
      station: "城东加油站",
      region: "华东一区",
      fuel: "92号汽油",
      price: 7.85,
      guidePrice: 7.85,
      applicant: "王强",
      effectiveDate: "2026-09-01",
      basis: "按区域指导价执行",
      reviewer: "李敏",
      status: "effective",
      createdAt: daysAgo(19),
      history: [
        { at: daysAgo(19), action: "登记待生效", actor: "王强", detail: "申请价 7.85 元，指导价 7.85 元，价差 +0.00 元" },
        { at: daysAgo(19, 11), action: "审批通过", actor: "李敏", detail: "生效日 2026-09-01，金额冻结为 7.85 元" },
      ],
    },
    {
      id: "seed-effective-2",
      station: "临港加油站",
      region: "华南一区",
      fuel: "柴油",
      price: 7.55,
      guidePrice: 7.55,
      applicant: "陈芳",
      effectiveDate: "2026-09-05",
      basis: "按区域指导价执行",
      reviewer: "周洁",
      status: "effective",
      createdAt: daysAgo(15),
      history: [
        { at: daysAgo(15), action: "登记待生效", actor: "陈芳", detail: "申请价 7.55 元，指导价 7.55 元，价差 +0.00 元" },
        { at: daysAgo(15, 10), action: "审批通过", actor: "周洁", detail: "生效日 2026-09-05，金额冻结为 7.55 元" },
      ],
    },
    {
      id: "seed-withdrawn-1",
      station: "机场路加油站",
      region: "华北一区",
      fuel: "92号汽油",
      price: 7.7,
      guidePrice: 7.79,
      applicant: "刘洋",
      effectiveDate: "2026-09-10",
      basis: "按区域指导价小幅下调",
      reviewer: "赵敏",
      status: "withdrawn",
      createdAt: daysAgo(12),
      history: [
        { at: daysAgo(12), action: "登记待生效", actor: "刘洋", detail: "申请价 7.70 元，指导价 7.79 元，价差 -0.09 元" },
        { at: daysAgo(11), action: "撤回", actor: "刘洋", detail: "总部通知暂缓调价，撤回后无有效价格，显示未定价" },
      ],
    },
  ];
}

function normalize(item: unknown): PriceAdjustment | null {
  if (!item || typeof item !== "object") return null;
  const raw = item as Record<string, unknown>;
  const status = STATUSES.includes(raw.status as AdjustmentStatus)
    ? (raw.status as AdjustmentStatus)
    : "draft";
  return {
    id: String(raw.id ?? crypto.randomUUID()),
    station: String(raw.station ?? ""),
    region: String(raw.region ?? ""),
    fuel: String(raw.fuel ?? ""),
    price: Number(raw.price) || 0,
    guidePrice: Number(raw.guidePrice) || 0,
    applicant: String(raw.applicant ?? ""),
    effectiveDate: String(raw.effectiveDate ?? ""),
    basis: String(raw.basis ?? ""),
    reviewer: String(raw.reviewer ?? ""),
    status,
    createdAt: String(raw.createdAt ?? new Date().toISOString()),
    history: Array.isArray(raw.history) ? (raw.history as PriceAdjustment["history"]) : [],
  };
}

export function loadAdjustments(): PriceAdjustment[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return seed();
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return seed();
    return parsed.map(normalize).filter((item): item is PriceAdjustment => item !== null);
  } catch {
    return seed();
  }
}

export function saveAdjustments(records: PriceAdjustment[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}
