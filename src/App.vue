<script setup lang="ts">
import { computed } from "vue";
import { usePriceStore } from "./store/priceStore";
import StationBoard from "./components/StationBoard.vue";
import PriceForm from "./components/PriceForm.vue";
import RecordList from "./components/RecordList.vue";
import HistoryPanel from "./components/HistoryPanel.vue";
import ExceptionPanel from "./components/ExceptionPanel.vue";

const store = usePriceStore();

const metricLabels = ["在管站点", "待复核", "待生效", "异常"];
const maxChart = computed(() => Math.max(1, ...store.statusChart.map((row) => row.value)));
</script>

<template>
  <main class="app">
    <div class="shell">
      <header class="topbar">
        <div>
          <p class="eyebrow">石油行业前端最小闭环</p>
          <h1>油品价格维护</h1>
          <p class="subtitle">
            站区联动维护挂牌价：登记站点、区域指导价、申请人与生效日；偏离指导价超 0.3
            元须填写依据并指定复核人，生效后金额冻结，改价先撤回未生效记录。
          </p>
        </div>
        <div class="stack">
          <span v-for="item in ['Vue3', 'Vite', 'TypeScript', 'Pinia', 'Naive UI']" :key="item" class="tag">
            {{ item }}
          </span>
        </div>
      </header>

      <section class="metrics">
        <article v-for="(label, index) in metricLabels" :key="label" class="metric">
          <span>{{ label }}</span>
          <strong>{{ store.metrics[index] }}</strong>
        </article>
      </section>

      <StationBoard />

      <section class="workspace">
        <PriceForm />
        <RecordList />
      </section>

      <section class="bottom-grid">
        <HistoryPanel />
        <ExceptionPanel />
      </section>

      <section class="panel">
        <h2>状态分布</h2>
        <div class="mini-chart">
          <div v-for="row in store.statusChart" :key="row.status" class="bar">
            <span>{{ row.status }}</span>
            <div class="bar-track">
              <div class="bar-fill" :style="{ width: `${(row.value / maxChart) * 100}%` }" />
            </div>
            <strong>{{ row.value }}</strong>
          </div>
        </div>
      </section>
    </div>
  </main>
</template>
