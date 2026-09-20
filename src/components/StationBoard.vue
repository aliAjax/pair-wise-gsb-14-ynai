<script setup lang="ts">
/**
 * 站区联动看板：区域 → 站点 → 油品
 * 当前价取最近生效记录，撤回后自动恢复最近有效价格，没有则显示未定价。
 */
import { computed } from "vue";
import { usePriceStore } from "../store/priceStore";
import { exceedsDeviation, formatDiff } from "../domain/rules";

const store = usePriceStore();
const groups = computed(() => store.boardGroups);
</script>

<template>
  <section class="panel board-panel">
    <div class="toolbar">
      <h2>站区价格看板</h2>
      <span class="hint">当前价 = 最近生效记录；偏离指导价超 0.3 元标红</span>
    </div>
    <div class="table-wrap">
      <table class="board">
        <thead>
          <tr>
            <th>区域</th>
            <th>站点</th>
            <th>油品</th>
            <th>当前价</th>
            <th>指导价</th>
            <th>价差</th>
            <th>在途调价</th>
          </tr>
        </thead>
        <tbody v-for="group in groups" :key="group.region">
          <tr v-for="(row, index) in group.rows" :key="`${row.station.id}-${row.fuel}`">
            <td v-if="index === 0" class="region-cell" :rowspan="group.rows.length">
              {{ group.region }}
            </td>
            <td>{{ row.station.name }}</td>
            <td>{{ row.fuel }}</td>
            <td>
              <strong v-if="row.current.price !== null">{{ row.current.price.toFixed(2) }}</strong>
              <span v-else class="unpriced">未定价</span>
            </td>
            <td>{{ row.guide ? row.guide.price.toFixed(2) : "—" }}</td>
            <td>
              <span
                v-if="row.diff !== null"
                :class="['diff', exceedsDeviation(row.current.price!, row.guide!.price) ? 'diff-over' : row.diff > 0 ? 'diff-up' : row.diff < 0 ? 'diff-down' : '']"
              >
                {{ formatDiff(row.diff) }}
              </span>
              <span v-else>—</span>
            </td>
            <td>
              <span v-if="row.pending" class="pending-tag">
                {{ row.pending.status }} {{ row.pending.price.toFixed(2) }}
              </span>
              <span v-else class="muted">—</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
