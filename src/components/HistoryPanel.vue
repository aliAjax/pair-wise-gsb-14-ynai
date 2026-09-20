<script setup lang="ts">
/**
 * 审批与撤销历史：持久化在存储层，刷新后保持一致。
 */
import { computed, ref } from "vue";
import { usePriceStore } from "../store/priceStore";
import type { HistoryAction } from "../domain/types";

const store = usePriceStore();

const tabs = [
  { key: "all", label: "全部" },
  { key: "approval", label: "审批流转" },
  { key: "withdraw", label: "撤销记录" },
] as const;
type TabKey = (typeof tabs)[number]["key"];

const APPROVAL_ACTIONS: HistoryAction[] = ["提交审批", "复核通过", "复核退回", "生效"];

const tab = ref<TabKey>("all");
const entries = computed(() => {
  if (tab.value === "approval") {
    return store.history.filter((entry) => APPROVAL_ACTIONS.includes(entry.action));
  }
  if (tab.value === "withdraw") {
    return store.history.filter((entry) => entry.action === "撤回");
  }
  return store.history;
});

const ACTION_CLASS: Record<string, string> = {
  登记: "st-pending",
  存草稿: "st-draft",
  提交审批: "st-review",
  复核通过: "st-pending",
  复核退回: "st-draft",
  生效: "st-active",
  撤回: "st-void",
};
</script>

<template>
  <section class="panel">
    <div class="toolbar">
      <h2>审批与撤销历史</h2>
      <div class="tabs">
        <button
          v-for="item in tabs"
          :key="item.key"
          type="button"
          :class="['tab', tab === item.key ? 'tab-active' : '']"
          @click="tab = item.key"
        >
          {{ item.label }}
        </button>
      </div>
    </div>
    <div v-if="entries.length === 0" class="empty">暂无历史记录</div>
    <ul v-else class="timeline">
      <li v-for="entry in entries" :key="entry.id">
        <span :class="['status', ACTION_CLASS[entry.action]]">{{ entry.action }}</span>
        <div class="timeline-body">
          <p class="timeline-title">
            {{ entry.stationName }} · {{ entry.fuel }} · 生效日 {{ entry.effectiveDate }}
          </p>
          <p class="timeline-detail">{{ entry.detail }}</p>
          <p class="timeline-meta">
            {{ entry.operator }} · {{ new Date(entry.at).toLocaleString("zh-CN", { hour12: false }) }}
          </p>
        </div>
      </li>
    </ul>
  </section>
</template>
