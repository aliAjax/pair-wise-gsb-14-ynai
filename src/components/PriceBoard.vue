<script setup lang="ts">
import { computed } from "vue";
import { FUELS, STATIONS } from "../data/stations";
import { currentPriceOf, pendingOf, type PriceAdjustment } from "../domain/priceRules";

const props = defineProps<{ records: PriceAdjustment[] }>();

const rows = computed(() =>
  STATIONS.map((station) => ({
    ...station,
    cells: FUELS.map((fuel) => ({
      fuel,
      current: currentPriceOf(props.records, station.name, fuel),
      pending: pendingOf(props.records, station.name, fuel),
    })),
  }))
);
</script>

<template>
  <div class="board-grid">
    <article v-for="row in rows" :key="row.name" class="board-station">
      <header>
        <strong>{{ row.name }}</strong>
        <span>{{ row.region }}</span>
      </header>
      <div class="fuel-cells">
        <div v-for="cell in row.cells" :key="cell.fuel" class="fuel-cell">
          <span class="fuel-name">{{ cell.fuel }}</span>
          <strong v-if="cell.current !== null">{{ cell.current.toFixed(2) }}</strong>
          <strong v-else class="unpriced">未定价</strong>
          <small v-if="cell.pending">待生效 → {{ cell.pending.price.toFixed(2) }} 元（{{ cell.pending.effectiveDate }}）</small>
        </div>
      </div>
    </article>
  </div>
</template>
