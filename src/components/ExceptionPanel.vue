<script setup lang="ts">
import { formatDateTime, type PriceAdjustment, type RuleException } from "../domain/priceRules";

defineProps<{
  exceptions: RuleException[];
  withdrawals: PriceAdjustment[];
}>();

function withdrawEntry(record: PriceAdjustment) {
  return [...record.history].reverse().find((entry) => entry.action === "撤回");
}
</script>

<template>
  <section class="panel">
    <h2>异常清单</h2>
    <div v-if="exceptions.length === 0" class="empty">暂无异常</div>
    <ul v-else class="exception-list">
      <li v-for="(item, index) in exceptions" :key="index" class="exception-item">
        <strong>{{ item.station }} · {{ item.fuel }}</strong>
        <span>生效日期: {{ item.effectiveDate }}</span>
        <p>{{ item.reason }}</p>
      </li>
    </ul>
  </section>
  <section class="panel">
    <h2>撤销历史</h2>
    <div v-if="withdrawals.length === 0" class="empty">暂无撤销记录</div>
    <ul v-else class="exception-list">
      <li v-for="record in withdrawals" :key="record.id" class="exception-item neutral">
        <strong>{{ record.station }} · {{ record.fuel }}</strong>
        <span>生效日期: {{ record.effectiveDate }} · 原申请价 {{ record.price.toFixed(2) }} 元</span>
        <p>
          {{ formatDateTime(withdrawEntry(record)?.at ?? record.createdAt) }} 由
          {{ withdrawEntry(record)?.actor ?? record.applicant }} 撤回
        </p>
      </li>
    </ul>
  </section>
</template>
