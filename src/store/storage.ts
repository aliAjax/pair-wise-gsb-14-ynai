/**
 * 存储层：localStorage 读写 + 种子数据。
 * 记录、审批/撤销历史、异常共用一份带版本的持久化信封，
 * 版本不符或解析失败时回退种子数据，保证刷新后状态一致。
 */
import type {
  ExceptionEntry,
  GuidePrice,
  HistoryEntry,
  PriceRecord,
  Station,
} from "../domain/types";

const STORAGE_KEY = "dfwlfront-9-price";
const STATE_VERSION = 2;

export interface PersistedState {
  version: number;
  stations: Station[];
  guidePrices: GuidePrice[];
  records: PriceRecord[];
  history: HistoryEntry[];
  exceptions: ExceptionEntry[];
}

export const STATIONS: Station[] = [
  { id: "st-east", name: "城东加油站", region: "华东区" },
  { id: "st-west", name: "城西加油站", region: "华东区" },
  { id: "st-port", name: "港区加油站", region: "华南区" },
  { id: "st-airport", name: "机场加油站", region: "华北区" },
];

export const GUIDE_PRICES: GuidePrice[] = [
  { region: "华东区", fuel: "92号汽油", price: 7.62 },
  { region: "华东区", fuel: "95号汽油", price: 8.1 },
  { region: "华东区", fuel: "98号汽油", price: 8.85 },
  { region: "华东区", fuel: "柴油", price: 7.18 },
  { region: "华南区", fuel: "92号汽油", price: 7.7 },
  { region: "华南区", fuel: "95号汽油", price: 8.18 },
  { region: "华南区", fuel: "98号汽油", price: 8.92 },
  { region: "华南区", fuel: "柴油", price: 7.25 },
  { region: "华北区", fuel: "92号汽油", price: 7.58 },
  { region: "华北区", fuel: "95号汽油", price: 8.05 },
  { region: "华北区", fuel: "98号汽油", price: 8.8 },
  { region: "华北区", fuel: "柴油", price: 7.12 },
];

function seedRecords(): PriceRecord[] {
  const now = Date.now();
  const at = (daysAgo: number) => new Date(now - daysAgo * 86400000).toISOString();
  return [
    {
      id: "seed-r1",
      stationId: "st-east",
      stationName: "城东加油站",
      region: "华东区",
      fuel: "92号汽油",
      price: 7.6,
      guidePrice: 7.62,
      applicant: "王强",
      effectiveDate: "2026-09-01",
      reason: "",
      reviewer: "",
      status: "生效中",
      createdAt: at(24),
      updatedAt: at(19),
    },
    {
      id: "seed-r2",
      stationId: "st-east",
      stationName: "城东加油站",
      region: "华东区",
      fuel: "柴油",
      price: 7.2,
      guidePrice: 7.18,
      applicant: "王强",
      effectiveDate: "2026-09-05",
      reason: "",
      reviewer: "",
      status: "生效中",
      createdAt: at(20),
      updatedAt: at(15),
    },
    {
      id: "seed-r3",
      stationId: "st-west",
      stationName: "城西加油站",
      region: "华东区",
      fuel: "95号汽油",
      price: 8.55,
      guidePrice: 8.1,
      applicant: "赵倩",
      effectiveDate: "2026-09-25",
      reason: "高速口竞品站连续涨价，本站客流流失明显，申请跟涨保利润",
      reviewer: "李敏",
      status: "待复核",
      createdAt: at(2),
      updatedAt: at(2),
    },
    {
      id: "seed-r4",
      stationId: "st-port",
      stationName: "港区加油站",
      region: "华南区",
      fuel: "92号汽油",
      price: 7.68,
      guidePrice: 7.7,
      applicant: "陈海",
      effectiveDate: "2026-09-22",
      reason: "",
      reviewer: "",
      status: "待生效",
      createdAt: at(1),
      updatedAt: at(1),
    },
    {
      id: "seed-r5",
      stationId: "st-airport",
      stationName: "机场加油站",
      region: "华北区",
      fuel: "柴油",
      price: 7.1,
      guidePrice: 7.12,
      applicant: "孙洁",
      effectiveDate: "2026-08-30",
      reason: "",
      reviewer: "",
      status: "生效中",
      createdAt: at(26),
      updatedAt: at(21),
    },
    {
      id: "seed-r6",
      stationId: "st-east",
      stationName: "城东加油站",
      region: "华东区",
      fuel: "95号汽油",
      price: 8.2,
      guidePrice: 8.1,
      applicant: "王强",
      effectiveDate: "2026-09-10",
      reason: "",
      reviewer: "",
      status: "已撤回",
      createdAt: at(12),
      updatedAt: at(10),
    },
    {
      id: "seed-r7",
      stationId: "st-port",
      stationName: "港区加油站",
      region: "华南区",
      fuel: "95号汽油",
      price: 8.6,
      guidePrice: 8.18,
      applicant: "陈海",
      effectiveDate: "2026-09-28",
      reason: "",
      reviewer: "",
      status: "草稿",
      createdAt: at(1),
      updatedAt: at(1),
    },
  ];
}

function seedHistory(): HistoryEntry[] {
  const now = Date.now();
  const at = (daysAgo: number, hour = 9) => {
    const d = new Date(now - daysAgo * 86400000);
    d.setHours(hour, 12, 0, 0);
    return d.toISOString();
  };
  return [
    {
      id: "seed-h1",
      recordId: "seed-r1",
      action: "提交审批",
      stationName: "城东加油站",
      fuel: "92号汽油",
      effectiveDate: "2026-09-01",
      operator: "王强",
      detail: "价差 -0.02 元，未超 0.3 元，直接待生效",
      at: at(24),
    },
    {
      id: "seed-h2",
      recordId: "seed-r1",
      action: "生效",
      stationName: "城东加油站",
      fuel: "92号汽油",
      effectiveDate: "2026-09-01",
      operator: "系统",
      detail: "生效日 2026-09-01 到达，金额冻结为 7.60 元",
      at: at(19, 0),
    },
    {
      id: "seed-h3",
      recordId: "seed-r2",
      action: "提交审批",
      stationName: "城东加油站",
      fuel: "柴油",
      effectiveDate: "2026-09-05",
      operator: "王强",
      detail: "价差 +0.02 元，未超 0.3 元，直接待生效",
      at: at(20),
    },
    {
      id: "seed-h4",
      recordId: "seed-r2",
      action: "生效",
      stationName: "城东加油站",
      fuel: "柴油",
      effectiveDate: "2026-09-05",
      operator: "系统",
      detail: "生效日 2026-09-05 到达，金额冻结为 7.20 元",
      at: at(15, 0),
    },
    {
      id: "seed-h5",
      recordId: "seed-r3",
      action: "提交审批",
      stationName: "城西加油站",
      fuel: "95号汽油",
      effectiveDate: "2026-09-25",
      operator: "赵倩",
      detail: "价差 +0.45 元，超 0.3 元，待李敏复核",
      at: at(2, 14),
    },
    {
      id: "seed-h6",
      recordId: "seed-r4",
      action: "提交审批",
      stationName: "港区加油站",
      fuel: "92号汽油",
      effectiveDate: "2026-09-22",
      operator: "陈海",
      detail: "价差 -0.02 元，未超 0.3 元，直接待生效",
      at: at(1, 10),
    },
    {
      id: "seed-h7",
      recordId: "seed-r5",
      action: "提交审批",
      stationName: "机场加油站",
      fuel: "柴油",
      effectiveDate: "2026-08-30",
      operator: "孙洁",
      detail: "价差 -0.02 元，未超 0.3 元，直接待生效",
      at: at(26),
    },
    {
      id: "seed-h8",
      recordId: "seed-r5",
      action: "生效",
      stationName: "机场加油站",
      fuel: "柴油",
      effectiveDate: "2026-08-30",
      operator: "系统",
      detail: "生效日 2026-08-30 到达，金额冻结为 7.10 元",
      at: at(21, 0),
    },
    {
      id: "seed-h9",
      recordId: "seed-r6",
      action: "提交审批",
      stationName: "城东加油站",
      fuel: "95号汽油",
      effectiveDate: "2026-09-10",
      operator: "王强",
      detail: "价差 +0.10 元，未超 0.3 元，直接待生效",
      at: at(12, 11),
    },
    {
      id: "seed-h10",
      recordId: "seed-r6",
      action: "撤回",
      stationName: "城东加油站",
      fuel: "95号汽油",
      effectiveDate: "2026-09-10",
      operator: "王强",
      detail: "改价前撤回未生效记录，恢复为未定价",
      at: at(10, 16),
    },
    {
      id: "seed-h11",
      recordId: "seed-r7",
      action: "存草稿",
      stationName: "港区加油站",
      fuel: "95号汽油",
      effectiveDate: "2026-09-28",
      operator: "陈海",
      detail: "偏离指导价 +0.42 元超过 0.3 元，缺少偏离依据、复核人，已仅存草稿",
      at: at(1, 15),
    },
  ];
}

function seedExceptions(): ExceptionEntry[] {
  return [
    {
      id: "seed-e1",
      stationName: "港区加油站",
      fuel: "95号汽油",
      effectiveDate: "2026-09-28",
      message: "偏离指导价 +0.42 元超过 0.3 元，缺少偏离依据、复核人，已仅存草稿",
      at: new Date(Date.now() - 1 * 86400000).toISOString(),
    },
  ];
}

export function seedState(): PersistedState {
  return {
    version: STATE_VERSION,
    stations: STATIONS,
    guidePrices: GUIDE_PRICES,
    records: seedRecords(),
    history: seedHistory(),
    exceptions: seedExceptions(),
  };
}

function isValidState(value: unknown): value is PersistedState {
  if (!value || typeof value !== "object") return false;
  const state = value as PersistedState;
  return (
    state.version === STATE_VERSION &&
    Array.isArray(state.records) &&
    Array.isArray(state.history) &&
    Array.isArray(state.exceptions) &&
    Array.isArray(state.stations) &&
    Array.isArray(state.guidePrices)
  );
}

export function loadState(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedState();
    const parsed: unknown = JSON.parse(raw);
    return isValidState(parsed) ? parsed : seedState();
  } catch {
    return seedState();
  }
}

export function saveState(state: PersistedState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, version: STATE_VERSION }));
  } catch {
    // 存储不可用（隐私模式等）时静默失败，页面内状态仍可用
  }
}
