<script setup lang="ts">
/**
 * 调价登记表单：站点联动区域与指导价；偏离超 0.3 元时要求依据与复核人。
 * 同站同油品存在在途记录时给出提示，提交仍由规则层拦截并记入异常。
 */
import { computed, reactive, ref } from "vue";
import { FUELS, type Fuel } from "../domain/types";
import { exceedsDeviation, findGuidePrice, findPendingRecord, formatDiff, priceDiff } from "../domain/rules";
import { usePriceStore } from "../store/priceStore";

const store = usePriceStore();

const form = reactive({
  stationId: "",
  fuel: "" as Fuel | "",
  price: "" as string | number,
  applicant: "",
  effectiveDate: "",
  reason: "",
  reviewer: "",
});

const message = ref<{ type: "ok" | "err"; text: string } | null>(null);

const station = computed(() => store.stations.find((item) => item.id === form.stationId));
const guide = computed(() =>
  station.value && form.fuel
    ? findGuidePrice(store.guidePrices, station.value.region, form.fuel as Fuel)
    : undefined,
);
const priceNum = computed(() => Number(form.price));
const hasPrice = computed(() => form.price !== "" && Number.isFinite(priceNum.value));
const diff = computed(() =>
  guide.value && hasPrice.value ? priceDiff(priceNum.value, guide.value.price) : null,
);
const overLimit = computed(() =>
  guide.value !== undefined && hasPrice.value && exceedsDeviation(priceNum.value, guide.value.price),
);
const pendingExisting = computed(() =>
  station.value && form.fuel
    ? findPendingRecord(store.records, station.value.id, form.fuel as Fuel)
    : undefined,
);

function reset() {
  form.price = "";
  form.reason = "";
  form.reviewer = "";
  message.value = null;
}

function submit(mode: "submit" | "draft") {
  const result = store.register(
    {
      stationId: form.stationId,
      fuel: form.fuel,
      price: priceNum.value,
      applicant: form.applicant,
      effectiveDate: form.effectiveDate,
      reason: form.reason,
      reviewer: form.reviewer,
    },
    mode,
  );
  message.value = { type: result.ok ? "ok" : "err", text: result.message };
  if (result.ok) reset();
}
</script>

<template>
  <form class="panel" @submit.prevent="submit('submit')">
    <h2>调价登记</h2>
    <div class="form-grid">
      <label>
        站点
        <select v-model="form.stationId" required>
          <option value="">请选择站点</option>
          <option v-for="item in store.stations" :key="item.id" :value="item.id">
            {{ item.name }}（{{ item.region }}）
          </option>
        </select>
      </label>
      <label>
        油品
        <select v-model="form.fuel" required>
          <option value="">请选择油品</option>
          <option v-for="fuel in FUELS" :key="fuel" :value="fuel">{{ fuel }}</option>
        </select>
      </label>

      <div v-if="station && guide" class="linked">
        <span>所属区域：{{ station.region }}</span>
        <span>区域指导价：{{ guide.price.toFixed(2) }} 元</span>
      </div>

      <label>
        申请价（元/升）
        <input v-model="form.price" type="number" min="0" step="0.01" placeholder="0.00" required />
      </label>

      <div v-if="diff !== null" :class="['diff-banner', overLimit ? 'diff-banner-over' : '']">
        价差 {{ formatDiff(diff) }} 元
        <template v-if="overLimit">，偏离超过 0.3 元，须填写依据并指定复核人，否则仅能存草稿</template>
        <template v-else>，偏离未超 0.3 元，提交后直接待生效</template>
      </div>

      <template v-if="overLimit">
        <label>
          偏离依据
          <textarea v-model="form.reason" placeholder="说明偏离指导价的原因与依据" />
        </label>
        <label>
          复核人
          <input v-model="form.reviewer" placeholder="指定复核人姓名" />
        </label>
      </template>

      <label>
        申请人
        <input v-model="form.applicant" placeholder="申请人姓名" required />
      </label>
      <label>
        生效日
        <input v-model="form.effectiveDate" type="date" required />
      </label>

      <div v-if="pendingExisting" class="warn">
        该站{{ form.fuel }}已存在{{ pendingExisting.status }}记录（生效日
        {{ pendingExisting.effectiveDate }}），同站同油品仅保留一笔在途记录，请先撤回。
      </div>

      <div class="form-actions">
        <button type="submit">提交审批</button>
        <button type="button" class="secondary" @click="submit('draft')">仅存草稿</button>
      </div>
      <p v-if="message" :class="['form-msg', message.type === 'ok' ? 'msg-ok' : 'msg-err']">
        {{ message.text }}
      </p>
    </div>
  </form>
</template>
