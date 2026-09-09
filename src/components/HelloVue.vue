<script setup lang="ts">
import { ref } from 'vue';

const count = ref(0);
</script>

<template>
  <div>
    <p>Vueアイランドの動作確認：{{ count }}</p>
    <button @click="count++">カウントアップ</button>
  </div>
</template>