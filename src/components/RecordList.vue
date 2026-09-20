<script setup lang="ts">
import {
  STATUS_LABELS,
  canApprove,
  canWithdraw,
  exceedsDeviation,
  formatDateTime,
  formatDeviation,
  type PriceAdjustment,
} from "../domain/priceRules";

defineProps<{ records: PriceAdjustment[] }>();

const emit = defineEmits<{
  approve: [record: PriceAdjustment];
  withdraw: [record: PriceAdjustment];
  resubmit: [record: PriceAdjustment];
  remove: [record: PriceAdjustment];
}>();

function summary(record: PriceAdjustment): string {
  return `${record.station} ${record.fuel} 挂牌价 ${record.price.toFixed(2)} 元（${STATUS_LABELS[record.status]}，生效日 ${record.effectiveDate}）`;
}

function copy(record: PriceAdjustment) {
  void navigator.clipboard?.writeText(summary(record));
}
</script>

<template>
  <div class="record-grid">
    <div v-if="records.length === 0" class="empty">暂无匹配数据</div>
    <article v-for="record in records" :key="record.id" class="record">
      <div class="record-head">
        <p class="record-title">{{ record.station }} · {{ record.fuel }}</p>
        <span class="status" :class="record.status">{{ STATUS_LABELS[record.status] }}</span>
      </div>
      <div class="details">
        <span>所属区域: {{ record.region }}</span>
        <span>挂牌价: {{ record.price.toFixed(2) }} 元</span>
        <span>区域指导价: {{ record.guidePrice.toFixed(2) }} 元</span>
        <span :class="{ 'over-text': exceedsDeviation(record.price, record.guidePrice) }">
          价差: {{ formatDeviation(record.price, record.guidePrice) }} 元
        </span>
        <span>申请人: {{ record.applicant }}</span>
        <span>复核人: {{ record.reviewer || "未指定" }}</span>
        <span>生效日期: {{ record.effectiveDate }}</span>
        <span>登记时间: {{ formatDateTime(record.createdAt) }}</span>
      </div>
      <p class="note" :class="{ missing: exceedsDeviation(record.price, record.guidePrice) && !record.basis }">
        调价依据: {{ record.basis || "未填写" }}
      </p>
      <ul class="timeline">
        <li v-for="(entry, index) in record.history" :key="index">
          {{ formatDateTime(entry.at) }} · {{ entry.action }} · {{ entry.actor }} — {{ entry.detail }}
        </li>
      </ul>
      <div class="actions">
        <button v-if="record.status === 'draft'" type="button" @click="emit('resubmit', record)">提交审核</button>
        <button v-if="canApprove(record)" type="button" @click="emit('approve', record)">审批通过</button>
        <button v-if="canWithdraw(record)" class="danger" type="button" @click="emit('withdraw', record)">撤回</button>
        <span v-if="record.status === 'effective'" class="frozen-tag">金额已冻结</span>
        <button class="secondary" type="button" @click="copy(record)">复制摘要</button>
        <button v-if="record.status === 'draft'" class="danger" type="button" @click="emit('remove', record)">删除</button>
      </div>
    </article>
  </div>
</template>
