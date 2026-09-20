<script setup lang="ts">
import { computed, ref } from "vue";
import AdjustForm from "./components/AdjustForm.vue";
import ExceptionPanel from "./components/ExceptionPanel.vue";
import PriceBoard from "./components/PriceBoard.vue";
import RecordList from "./components/RecordList.vue";
import { FUELS, regionOf } from "./data/stations";
import {
  STATUS_LABELS,
  canApprove,
  canWithdraw,
  collectExceptions,
  currentPriceOf,
  deviationOf,
  evaluateSubmission,
  formatDeviation,
  roundMoney,
  type AdjustmentInput,
  type AdjustmentStatus,
  type PriceAdjustment,
} from "./domain/priceRules";
import { loadAdjustments, saveAdjustments } from "./storage/priceStore";

const project = {
  industry: "石油",
  title: "油品价格维护",
  subtitle:
    "站区联动登记调价：偏离指导价超 0.30 元须填写依据并指定复核人，否则仅存草稿；审批生效后金额冻结，改价先撤回未生效记录。",
  stack: ["Vue3", "Vite", "TypeScript", "Pinia", "Naive UI"],
  formTitle: "调整油品价格",
  entityLabel: "调价记录",
  metricLabels: ["登记站点", "待生效", "平均价差"],
} as const;

const filters = ["全部油品", ...FUELS];
const chartStatuses: AdjustmentStatus[] = ["effective", "pending", "draft", "withdrawn"];

const records = ref<PriceAdjustment[]>(loadAdjustments());
const filter = ref(filters[0]);
const lastMessage = ref("");

const filteredRecords = computed(() => {
  if (filter.value === filters[0]) return records.value;
  return records.value.filter((record) => record.fuel === filter.value);
});

const metrics = computed(() => {
  const stations = new Set(records.value.map((record) => record.station)).size;
  const pending = records.value.filter((record) => record.status === "pending").length;
  const active = records.value.filter((record) => record.status !== "withdrawn");
  const avg = active.length
    ? active.reduce((sum, record) => sum + Math.abs(deviationOf(record.price, record.guidePrice)), 0) / active.length
    : 0;
  return [stations, pending, `${avg.toFixed(2)} 元`];
});

const chartRows = computed(() =>
  chartStatuses.map((status) => ({
    label: STATUS_LABELS[status],
    value: records.value.filter((record) => record.status === status).length,
  }))
);

const maxChart = computed(() => Math.max(1, ...chartRows.value.map((row) => row.value)));

const exceptions = computed(() => collectExceptions(records.value));

const withdrawals = computed(() =>
  records.value
    .filter((record) => record.status === "withdrawn")
    .slice()
    .sort((a, b) => lastAt(b).localeCompare(lastAt(a)))
);

function lastAt(record: PriceAdjustment): string {
  return record.history.length ? record.history[record.history.length - 1].at : record.createdAt;
}

function now() {
  return new Date().toISOString();
}

function persist() {
  saveAdjustments(records.value);
}

function onSubmit(input: AdjustmentInput) {
  const { status, exceptions: problems } = evaluateSubmission(input, records.value);
  const record: PriceAdjustment = {
    ...input,
    price: roundMoney(input.price),
    guidePrice: roundMoney(input.guidePrice),
    region: regionOf(input.station),
    id: crypto.randomUUID(),
    status,
    createdAt: now(),
    history: [
      {
        at: now(),
        action: status === "pending" ? "登记待生效" : "保存草稿",
        actor: input.applicant,
        detail: `申请价 ${input.price.toFixed(2)} 元，指导价 ${input.guidePrice.toFixed(2)} 元，价差 ${formatDeviation(input.price, input.guidePrice)} 元`,
      },
    ],
  };
  records.value = [record, ...records.value];
  persist();
  lastMessage.value =
    status === "pending"
      ? `${input.station} ${input.fuel} 已登记待生效，等待复核人审批。`
      : `已存草稿：${problems.map((item) => item.reason).join("；")}`;
}

function approve(record: PriceAdjustment) {
  if (!canApprove(record)) return;
  record.status = "effective";
  record.history.push({
    at: now(),
    action: "审批通过",
    actor: record.reviewer || "复核人",
    detail: `生效日 ${record.effectiveDate}，金额冻结为 ${record.price.toFixed(2)} 元`,
  });
  persist();
  lastMessage.value = `${record.station} ${record.fuel} 已审批生效，金额冻结。`;
}

function withdraw(record: PriceAdjustment) {
  if (!canWithdraw(record)) return;
  record.status = "withdrawn";
  const restored = currentPriceOf(records.value, record.station, record.fuel);
  record.history.push({
    at: now(),
    action: "撤回",
    actor: record.applicant,
    detail: restored === null ? "撤回后无有效价格，显示未定价" : `撤回后恢复最近有效价格 ${restored.toFixed(2)} 元`,
  });
  persist();
  lastMessage.value = `${record.station} ${record.fuel} 已撤回。`;
}

function resubmit(record: PriceAdjustment) {
  if (record.status !== "draft") return;
  const { status, exceptions: problems } = evaluateSubmission(record, records.value, record.id);
  if (status === "pending") {
    record.status = "pending";
    record.history.push({
      at: now(),
      action: "提交审核",
      actor: record.applicant,
      detail: "草稿补齐要素后提交，等待复核审批",
    });
    persist();
    lastMessage.value = `${record.station} ${record.fuel} 已提交，待复核审批。`;
  } else {
    lastMessage.value = `仍为草稿：${problems.map((item) => item.reason).join("；")}`;
  }
}

function remove(record: PriceAdjustment) {
  if (record.status !== "draft") return;
  records.value = records.value.filter((item) => item.id !== record.id);
  persist();
}
</script>

<template>
  <main class="app">
    <div class="shell">
      <header class="topbar">
        <div>
          <p class="eyebrow">{{ project.industry }}行业前端最小闭环</p>
          <h1>{{ project.title }}</h1>
          <p class="subtitle">{{ project.subtitle }}</p>
        </div>
        <div class="stack">
          <span v-for="item in project.stack" :key="item" class="tag">{{ item }}</span>
        </div>
      </header>

      <section class="metrics">
        <article v-for="(label, index) in project.metricLabels" :key="label" class="metric">
          <span>{{ label }}</span>
          <strong>{{ metrics[index] }}</strong>
        </article>
      </section>

      <section class="workspace">
        <div class="panel">
          <h2>{{ project.formTitle }}</h2>
          <AdjustForm @submit="onSubmit" />
          <p v-if="lastMessage" class="form-message">{{ lastMessage }}</p>
        </div>

        <section class="list-panel">
          <div class="toolbar">
            <h2>{{ project.entityLabel }}列表</h2>
            <select v-model="filter">
              <option v-for="item in filters" :key="item">{{ item }}</option>
            </select>
          </div>
          <RecordList
            :records="filteredRecords"
            @approve="approve"
            @withdraw="withdraw"
            @resubmit="resubmit"
            @remove="remove"
          />
          <div class="mini-chart">
            <div v-for="row in chartRows" :key="row.label" class="bar">
              <span>{{ row.label }}</span>
              <div class="bar-track"><div class="bar-fill" :style="{ width: `${(row.value / maxChart) * 100}%` }" /></div>
              <strong>{{ row.value }}</strong>
            </div>
          </div>
        </section>
      </section>

      <section class="panel board-panel">
        <h2>当前挂牌价（站区联动）</h2>
        <PriceBoard :records="records" />
      </section>

      <section class="bottom-grid">
        <ExceptionPanel :exceptions="exceptions" :withdrawals="withdrawals" />
      </section>
    </div>
  </main>
</template>
