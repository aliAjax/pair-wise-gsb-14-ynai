<script setup lang="ts">
/**
 * 异常列表：统一展示站点、油品、日期与异常说明，随存储持久化。
 */
import { usePriceStore } from "../store/priceStore";

const store = usePriceStore();
</script>

<template>
  <section class="panel">
    <div class="toolbar">
      <h2>异常列表</h2>
      <button
        type="button"
        class="secondary"
        :disabled="store.exceptions.length === 0"
        @click="store.clearExceptions()"
      >
        清空异常
      </button>
    </div>
    <div v-if="store.exceptions.length === 0" class="empty">暂无异常</div>
    <div v-else class="table-wrap">
      <table class="board">
        <thead>
          <tr>
            <th>站点</th>
            <th>油品</th>
            <th>日期</th>
            <th>异常说明</th>
            <th>记录时间</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in store.exceptions" :key="item.id">
            <td>{{ item.stationName }}</td>
            <td>{{ item.fuel }}</td>
            <td>{{ item.effectiveDate }}</td>
            <td>{{ item.message }}</td>
            <td>{{ new Date(item.at).toLocaleString("zh-CN", { hour12: false }) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
