/**
 * 状态层：Pinia store，负责把纯规则（domain/rules）与持久化（store/storage）
 * 串成页面可调用的动作；所有变更先走规则校验，再落库，保证刷新后一致。
 */
import { computed, ref } from "vue";
import { defineStore } from "pinia";
import {
  FUELS,
  RECORD_STATUSES,
  type ExceptionEntry,
  type Fuel,
  type HistoryAction,
  type HistoryEntry,
  type PriceRecord,
  type RegisterInput,
} from "../domain/types";
import * as rules from "../domain/rules";
import { loadState, saveState } from "./storage";

export interface ActionResult {
  ok: boolean;
  message: string;
}

function uid(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const usePriceStore = defineStore("price", () => {
  const state = loadState();
  const stations = ref(state.stations);
  const guidePrices = ref(state.guidePrices);
  const records = ref<PriceRecord[]>(state.records);
  const history = ref<HistoryEntry[]>(state.history);
  const exceptions = ref<ExceptionEntry[]>(state.exceptions);

  function persist() {
    saveState({
      version: 2,
      stations: stations.value,
      guidePrices: guidePrices.value,
      records: records.value,
      history: history.value,
      exceptions: exceptions.value,
    });
  }

  function logHistory(
    record: Pick<PriceRecord, "id" | "stationName" | "fuel" | "effectiveDate">,
    action: HistoryAction,
    operator: string,
    detail: string,
  ) {
    history.value = [
      {
        id: uid(),
        recordId: record.id,
        action,
        stationName: record.stationName,
        fuel: record.fuel,
        effectiveDate: record.effectiveDate,
        operator,
        detail,
        at: new Date().toISOString(),
      },
      ...history.value,
    ];
  }

  function logException(
    stationName: string,
    fuel: string,
    effectiveDate: string,
    message: string,
  ) {
    exceptions.value = [
      { id: uid(), stationName, fuel, effectiveDate, message, at: new Date().toISOString() },
      ...exceptions.value,
    ];
  }

  /** 生效结算：生效日到达的待生效记录转为生效中并冻结金额（幂等，可反复调用） */
  function settle(today: string = rules.todayStr()) {
    let changed = false;
    for (const record of records.value) {
      if (rules.dueForActivation(record, today)) {
        record.status = "生效中";
        record.updatedAt = new Date().toISOString();
        logHistory(record, "生效", "系统", `生效日 ${record.effectiveDate} 到达，金额冻结为 ${record.price.toFixed(2)} 元`);
        changed = true;
      }
    }
    if (changed) persist();
  }

  /**
   * 登记调价。
   * mode = "submit" 提交审批：按偏离幅度决定待生效 / 待复核 / 只能存草稿；
   * mode = "draft" 主动存草稿。
   */
  function register(input: RegisterInput, mode: "submit" | "draft"): ActionResult {
    const errors = rules.validateRegisterInput(input);
    if (errors.length > 0) return { ok: false, message: errors.join("；") };

    const station = stations.value.find((item) => item.id === input.stationId);
    if (!station) return { ok: false, message: "站点不存在" };
    const fuel = input.fuel as Fuel;
    const guide = rules.findGuidePrice(guidePrices.value, station.region, fuel);
    if (!guide) return { ok: false, message: `${station.region} 未配置${fuel}指导价` };

    // 同站同油品只能保留一笔在途（未生效）记录
    const existing = rules.findPendingRecord(records.value, station.id, fuel);
    if (existing) {
      const message = `${station.name} ${fuel} 已存在${existing.status}记录（生效日 ${existing.effectiveDate}），请先撤回再登记`;
      logException(station.name, fuel, input.effectiveDate, message);
      persist();
      return { ok: false, message };
    }

    const now = new Date().toISOString();
    const record: PriceRecord = {
      id: uid(),
      stationId: station.id,
      stationName: station.name,
      region: station.region,
      fuel,
      price: Math.round(input.price * 100) / 100,
      guidePrice: guide.price,
      applicant: input.applicant.trim(),
      effectiveDate: input.effectiveDate,
      reason: input.reason.trim(),
      reviewer: input.reviewer.trim(),
      status: "草稿",
      createdAt: now,
      updatedAt: now,
    };

    const diffText = rules.formatDiff(rules.priceDiff(record.price, record.guidePrice));
    let message: string;
    if (mode === "draft") {
      logHistory(record, "存草稿", record.applicant, `手动存草稿，价差 ${diffText} 元`);
      message = "已存草稿";
    } else {
      const decision = rules.decideSubmit(record.price, record.guidePrice, record.reason, record.reviewer);
      record.status = decision.status;
      if (decision.kind === "draftOnly") {
        const why = `偏离指导价 ${diffText} 元超过 0.3 元，缺少${decision.missing.join("、")}，已仅存草稿`;
        logException(record.stationName, record.fuel, record.effectiveDate, why);
        logHistory(record, "存草稿", record.applicant, why);
        message = why;
      } else if (decision.kind === "review") {
        logHistory(record, "提交审批", record.applicant, `价差 ${diffText} 元，超 0.3 元，待${record.reviewer}复核`);
        message = `偏离超 0.3 元，已提交 ${record.reviewer} 复核`;
      } else {
        logHistory(record, "提交审批", record.applicant, `价差 ${diffText} 元，未超 0.3 元，直接待生效`);
        message = "已登记为待生效";
      }
    }

    records.value = [record, ...records.value];
    persist();
    settle();
    return { ok: true, message };
  }

  /** 草稿补齐依据 / 复核人后提交审批 */
  function submitDraft(id: string, reason: string, reviewer: string): ActionResult {
    const record = records.value.find((item) => item.id === id);
    if (!record || !rules.canSubmitDraft(record)) return { ok: false, message: "仅草稿可提交" };
    record.reason = reason.trim();
    record.reviewer = reviewer.trim();
    const decision = rules.decideSubmit(record.price, record.guidePrice, record.reason, record.reviewer);
    if (decision.kind === "draftOnly") {
      const why = `偏离指导价 ${rules.formatDiff(rules.priceDiff(record.price, record.guidePrice))} 元超过 0.3 元，缺少${decision.missing.join("、")}，仍为草稿`;
      logException(record.stationName, record.fuel, record.effectiveDate, why);
      persist();
      return { ok: false, message: why };
    }
    record.status = decision.status;
    record.updatedAt = new Date().toISOString();
    const diffText = rules.formatDiff(rules.priceDiff(record.price, record.guidePrice));
    logHistory(
      record,
      "提交审批",
      record.applicant,
      decision.kind === "review"
        ? `价差 ${diffText} 元，超 0.3 元，待${record.reviewer}复核`
        : `价差 ${diffText} 元，未超 0.3 元，直接待生效`,
    );
    persist();
    settle();
    return { ok: true, message: decision.kind === "review" ? `已提交 ${record.reviewer} 复核` : "已登记为待生效" };
  }

  /** 复核通过：待复核 → 待生效 */
  function approve(id: string, operator: string): ActionResult {
    const record = records.value.find((item) => item.id === id);
    if (!record || !rules.canApprove(record)) return { ok: false, message: "该记录不在待复核状态" };
    record.status = "待生效";
    record.updatedAt = new Date().toISOString();
    logHistory(record, "复核通过", operator || record.reviewer, `复核人确认偏离依据，转待生效`);
    persist();
    settle();
    return { ok: true, message: "复核通过，转待生效" };
  }

  /** 复核退回：待复核 → 草稿，需补齐要素后重新提交 */
  function reject(id: string, operator: string): ActionResult {
    const record = records.value.find((item) => item.id === id);
    if (!record || !rules.canApprove(record)) return { ok: false, message: "该记录不在待复核状态" };
    record.status = "草稿";
    record.updatedAt = new Date().toISOString();
    logHistory(record, "复核退回", operator || record.reviewer, "复核不通过，退回草稿");
    persist();
    return { ok: true, message: "已退回草稿" };
  }

  /** 撤回未生效记录：撤回后恢复最近有效价格，没有则未定价；生效中金额冻结不可撤回 */
  function withdraw(id: string, operator: string): ActionResult {
    const record = records.value.find((item) => item.id === id);
    if (!record) return { ok: false, message: "记录不存在" };
    if (!rules.canWithdraw(record)) {
      const message = rules.isFrozen(record)
        ? `${record.stationName} ${record.fuel} 已生效，金额冻结，不可撤回`
        : "该记录已撤回";
      if (rules.isFrozen(record)) {
        logException(record.stationName, record.fuel, record.effectiveDate, message);
        persist();
      }
      return { ok: false, message };
    }
    const fromStatus = record.status;
    record.status = "已撤回";
    record.updatedAt = new Date().toISOString();
    const restore = rules.restoreTextAfterWithdraw(records.value, record.stationId, record.fuel);
    logHistory(record, "撤回", operator || record.applicant, `撤回${fromStatus}记录，${restore}`);
    persist();
    return { ok: true, message: `已撤回，${restore}` };
  }

  function clearExceptions() {
    exceptions.value = [];
    persist();
  }

  // ---- 派生数据 ----

  const metrics = computed(() => [
    stations.value.length,
    records.value.filter((record) => record.status === "待复核").length,
    records.value.filter((record) => record.status === "待生效").length,
    exceptions.value.length,
  ]);

  const statusChart = computed(() =>
    RECORD_STATUSES.map((status) => ({
      status,
      value: records.value.filter((record) => record.status === status).length,
    })),
  );

  /** 站区联动看板：区域 → 站点 → 油品，当前价 / 指导价 / 价差 / 在途记录 */
  const boardGroups = computed(() => {
    const regions = [...new Set(stations.value.map((station) => station.region))];
    return regions.map((region) => ({
      region,
      rows: stations.value
        .filter((station) => station.region === region)
        .flatMap((station) =>
          FUELS.map((fuel) => {
            const guide = rules.findGuidePrice(guidePrices.value, station.region, fuel);
            const current = rules.resolveCurrentPrice(records.value, station.id, fuel);
            const pending = rules.findPendingRecord(records.value, station.id, fuel);
            const diff =
              current.price !== null && guide ? rules.priceDiff(current.price, guide.price) : null;
            return { station, fuel, guide, current, pending, diff };
          }),
        ),
    }));
  });

  // 首次加载即结算到期记录，保证刷新后审批状态与看板一致
  settle();

  return {
    stations,
    guidePrices,
    records,
    history,
    exceptions,
    metrics,
    statusChart,
    boardGroups,
    register,
    submitDraft,
    approve,
    reject,
    withdraw,
    clearExceptions,
    settle,
  };
});
