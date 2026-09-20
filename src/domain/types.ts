/**
 * 领域模型：油品价格维护（站区联动 + 调价审批）
 * 仅放类型与常量，不含任何逻辑，规则见 rules.ts。
 */

export const FUELS = ["92号汽油", "95号汽油", "98号汽油", "柴油"] as const;
export type Fuel = (typeof FUELS)[number];

/**
 * 调价记录状态机：
 * 草稿 → 提交审批 →（偏离≤0.3 元）待生效 → 生效中
 *                →（偏离>0.3 元且依据/复核人齐全）待复核 → 复核通过 → 待生效 → 生效中
 * 任意未生效状态 → 撤回 → 已撤回；生效中金额冻结，不可再改、不可撤回。
 */
export const RECORD_STATUSES = ["草稿", "待复核", "待生效", "生效中", "已撤回"] as const;
export type RecordStatus = (typeof RECORD_STATUSES)[number];

/** 未生效（在途）状态：同站同油品在途记录只能保留一笔 */
export const PENDING_STATUSES: readonly RecordStatus[] = ["草稿", "待复核", "待生效"];

/** 偏离指导价阈值：三角钱（0.3 元），超过即触发审批要素校验 */
export const DEVIATION_LIMIT_YUAN = 0.3;

export interface Station {
  id: string;
  name: string;
  region: string;
}

/** 区域指导价：按区域 + 油品维护，登记调价时快照进记录 */
export interface GuidePrice {
  region: string;
  fuel: Fuel;
  price: number;
}

export interface PriceRecord {
  id: string;
  stationId: string;
  stationName: string;
  region: string;
  fuel: Fuel;
  /** 申请挂牌价（元/升），生效后冻结 */
  price: number;
  /** 登记时的区域指导价快照 */
  guidePrice: number;
  applicant: string;
  /** 生效日，格式 YYYY-MM-DD */
  effectiveDate: string;
  /** 偏离依据（偏离超 0.3 元时必填） */
  reason: string;
  /** 复核人（偏离超 0.3 元时必指定） */
  reviewer: string;
  status: RecordStatus;
  createdAt: string;
  updatedAt: string;
}

export type HistoryAction =
  | "登记"
  | "存草稿"
  | "提交审批"
  | "复核通过"
  | "复核退回"
  | "生效"
  | "撤回";

/** 审批 / 撤销历史：刷新后需与记录状态、价差保持一致 */
export interface HistoryEntry {
  id: string;
  recordId: string;
  action: HistoryAction;
  stationName: string;
  fuel: Fuel;
  effectiveDate: string;
  operator: string;
  detail: string;
  at: string;
}

/** 业务异常：统一列出站点、油品、日期 */
export interface ExceptionEntry {
  id: string;
  stationName: string;
  fuel: string;
  effectiveDate: string;
  message: string;
  at: string;
}

/** 调价登记表单输入 */
export interface RegisterInput {
  stationId: string;
  fuel: Fuel | "";
  price: number;
  applicant: string;
  effectiveDate: string;
  reason: string;
  reviewer: string;
}
