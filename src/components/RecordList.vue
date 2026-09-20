<script setup lang="ts">
/**
 * 调价记录与审批：按状态给出可执行动作。
 * 草稿可补齐依据/复核人后提交；待复核可通过或退回；待生效可撤回；生效中金额冻结。
 */
import { computed, reactive, ref } from "vue";
import { FUELS, RECORD_STATUSES, type PriceRecord } from "../domain/types";
import { exceedsDeviation, formatDiff, priceDiff } from "../domain/rules";
import { usePriceStore } from "../store/priceStore";

const store = usePriceStore();

const fuelFilter = ref("全部油品");
const statusFilter = ref("全部状态");
const operator = ref("值班经理");
const message = ref<{ type: "ok" | "err"; text: string } | null>(null);

/** 草稿卡片内联补齐的依据 / 复核人 */
const draftEdits = reactive<Record<string, { reason: string; reviewer: string }>>({});

const STATUS_CLASS: Record<string, string> = {
  草稿: "st-draft",
  待复核: "st-review",
  待生效: "st-pending",
  生效中: "st-active",
  已撤回: "st-void",
};

const filtered = computed(() =>
  store.records.filter((record) => {
    const fuelOk = fuelFilter.value === "全部油品" || record.fuel === fuelFilter.value;
    const statusOk = statusFilter.value === "全部状态" || record.status === statusFilter.value;
    return fuelOk && statusOk;
  }),
);

function diffOf(record: PriceRecord) {
  return priceDiff(record.price, record.guidePrice);
}

function draftEdit(record: PriceRecord) {
  if (!draftEdits[record.id]) {
    draftEdits[record.id] = { reason: record.reason, reviewer: record.reviewer };
  }
  return draftEdits[record.id];
}

function act(result: { ok: boolean; message: string }) {
  message.value = { type: result.ok ? "ok" : "err", text: result.message };
}

function submitDraft(record: PriceRecord) {
  const edit = draftEdit(record);
  act(store.submitDraft(record.id, edit.reason, edit.reviewer));
}
</script>

<template>
  <section class="list-panel">
    <div class="toolbar">
      <h2>调价记录</h2>
      <div class="toolbar-controls">
        <label class="toolbar-field">
          操作人
          <input v-model="operator" placeholder="复核 / 撤回操作人" />
        </label>
        <select v-model="fuelFilter">
          <option>全部油品</option>
          <option v-for="fuel in FUELS" :key="fuel">{{ fuel }}</option>
        </select>
        <select v-model="statusFilter">
          <option>全部状态</option>
          <option v-for="status in RECORD_STATUSES" :key="status">{{ status }}</option>
        </select>
      </div>
    </div>

    <p v-if="message" :class="['form-msg', message.type === 'ok' ? 'msg-ok' : 'msg-err']">
      {{ message.text }}
    </p>

    <div class="record-grid">
      <div v-if="filtered.length === 0" class="empty">暂无匹配数据</div>
      <article v-for="record in filtered" :key="record.id" class="record">
        <div class="record-head">
          <p class="record-title">{{ record.stationName }} · {{ record.fuel }}</p>
          <span :class="['status', STATUS_CLASS[record.status]]">
            {{ record.status }}<template v-if="record.status === '生效中'"> · 金额冻结</template>
          </span>
        </div>
        <div class="details">
          <span>申请价: {{ record.price.toFixed(2) }} 元</span>
          <span>指导价: {{ record.guidePrice.toFixed(2) }} 元</span>
          <span>
            价差:
            <em
              :class="['diff', exceedsDeviation(record.price, record.guidePrice) ? 'diff-over' : diffOf(record) > 0 ? 'diff-up' : diffOf(record) < 0 ? 'diff-down' : '']"
            >
              {{ formatDiff(diffOf(record)) }} 元
            </em>
          </span>
          <span>区域: {{ record.region }}</span>
          <span>申请人: {{ record.applicant }}</span>
          <span>复核人: {{ record.reviewer || "—" }}</span>
          <span>生效日: {{ record.effectiveDate }}</span>
          <span>登记时间: {{ new Date(record.createdAt).toLocaleString("zh-CN", { hour12: false }) }}</span>
        </div>
        <p v-if="record.reason" class="note">依据：{{ record.reason }}</p>

        <div v-if="record.status === '草稿'" class="draft-edit">
          <input v-model="draftEdit(record).reason" placeholder="偏离依据（超 0.3 元必填）" />
          <input v-model="draftEdit(record).reviewer" placeholder="复核人（超 0.3 元必填）" />
        </div>

        <div class="actions">
          <template v-if="record.status === '草稿'">
            <button type="button" @click="submitDraft(record)">提交审批</button>
            <button type="button" class="danger" @click="act(store.withdraw(record.id, operator))">撤回</button>
          </template>
          <template v-else-if="record.status === '待复核'">
            <button type="button" @click="act(store.approve(record.id, operator))">复核通过</button>
            <button type="button" class="secondary" @click="act(store.reject(record.id, operator))">退回草稿</button>
            <button type="button" class="danger" @click="act(store.withdraw(record.id, operator))">撤回</button>
          </template>
          <template v-else-if="record.status === '待生效'">
            <button type="button" class="danger" @click="act(store.withdraw(record.id, operator))">撤回（改价先撤回）</button>
          </template>
          <span v-else-if="record.status === '生效中'" class="frozen-tip">🔒 金额已冻结，改价需登记新调价</span>
          <span v-else class="muted">已撤回，价格已恢复</span>
        </div>
      </article>
    </div>
  </section>
</template>
