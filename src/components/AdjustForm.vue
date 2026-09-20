<script setup lang="ts">
import { computed, reactive } from "vue";
import { FUELS, STATIONS, guidePriceOf, regionOf } from "../data/stations";
import {
  DEVIATION_LIMIT,
  deviationOf,
  exceedsDeviation,
  formatDeviation,
  type AdjustmentInput,
} from "../domain/priceRules";

const emit = defineEmits<{
  submit: [input: AdjustmentInput];
}>();

function blankForm() {
  return {
    station: "",
    fuel: "",
    price: "",
    applicant: "",
    effectiveDate: "",
    basis: "",
    reviewer: "",
  };
}

const form = reactive(blankForm());

const region = computed(() => regionOf(form.station));
const guidePrice = computed(() => (form.station && form.fuel ? guidePriceOf(form.station, form.fuel) : null));
const priceNumber = computed(() => Number(form.price));
const deviation = computed(() => {
  if (guidePrice.value === null || !(priceNumber.value > 0)) return null;
  return deviationOf(priceNumber.value, guidePrice.value);
});
const overLimit = computed(
  () => deviation.value !== null && guidePrice.value !== null && exceedsDeviation(priceNumber.value, guidePrice.value)
);

const hint = computed(() => {
  if (deviation.value === null || guidePrice.value === null) return "选择站点与油品后自动带出区域指导价";
  const text = `价差 ${formatDeviation(priceNumber.value, guidePrice.value)} 元`;
  return overLimit.value
    ? `${text}，超出 ±${DEVIATION_LIMIT.toFixed(2)} 元：须填写调价依据并指定复核人，否则仅存草稿`
    : `${text}，在 ±${DEVIATION_LIMIT.toFixed(2)} 元以内，可直接登记待生效`;
});

function submit() {
  if (guidePrice.value === null) return;
  emit("submit", {
    station: form.station,
    fuel: form.fuel,
    price: priceNumber.value,
    guidePrice: guidePrice.value,
    applicant: form.applicant.trim(),
    effectiveDate: form.effectiveDate,
    basis: form.basis.trim(),
    reviewer: form.reviewer.trim(),
  });
  Object.assign(form, blankForm());
}
</script>

<template>
  <form class="form-grid" @submit.prevent="submit">
    <label>
      站点
      <select v-model="form.station" required>
        <option value="">请选择站点</option>
        <option v-for="item in STATIONS" :key="item.name" :value="item.name">{{ item.name }}</option>
      </select>
    </label>
    <label>
      所属区域
      <input :value="region || '选择站点后自动匹配'" type="text" readonly />
    </label>
    <label>
      油品
      <select v-model="form.fuel" required>
        <option value="">请选择油品</option>
        <option v-for="item in FUELS" :key="item" :value="item">{{ item }}</option>
      </select>
    </label>
    <label>
      区域指导价（元/升）
      <input :value="guidePrice === null ? '未配置' : guidePrice.toFixed(2)" type="text" readonly />
    </label>
    <label>
      挂牌价（元/升）
      <input v-model="form.price" type="number" min="0" step="0.01" placeholder="如 7.85" required />
    </label>
    <label>
      申请人
      <input v-model="form.applicant" type="text" placeholder="填写申请人姓名" required />
    </label>
    <label>
      生效日期
      <input v-model="form.effectiveDate" type="date" required />
    </label>
    <label>
      复核人
      <input v-model="form.reviewer" type="text" placeholder="价差超 0.30 元时必填" />
    </label>
    <label>
      调价依据
      <textarea v-model="form.basis" placeholder="价差超 0.30 元时必填，说明调价原因与数据来源" />
    </label>
    <p class="hint" :class="{ warn: overLimit }">{{ hint }}</p>
    <button type="submit">保存价格</button>
  </form>
</template>
