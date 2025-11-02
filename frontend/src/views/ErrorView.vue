<template>
  <div class="error-container">
    <div class="content-wrapper">
      <h3>오류 발생</h3>
      <p>요청 처리 중 오류가 발생했습니다. 잠시 후 다시 시도하거나 관리자에게 문의하세요.</p>
      <button @click="goHome">홈으로 돌아가기</button>
    </div>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router';

const router = useRouter();

const goHome = () => {
  router.push('/');
};
</script>

<style scoped>
.error-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  text-align: center;
  padding: 2rem;
  background-color: #f4f6f8;
  color: #333;
}

.content-wrapper {
  background: white;
  padding: 4rem;
  border-radius: 15px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
  text-align: center;
}

h3 {
  color: #e74c3c;
  margin-bottom: 1rem;
  font-size: 2.5rem;
  font-weight: 700;
}

p {
  color: #555;
  margin-bottom: 2rem;
  font-size: 1.2rem;
  font-weight: 500;
}

button {
  padding: 1rem 2rem;
  border: none;
  border-radius: 8px;
  background-color: #009B8A;
  color: white;
  font-size: 1.1rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(0, 155, 138, 0.3);
}

button:hover {
  background-color: #007a6e;
  transform: translateY(-3px);
  box-shadow: 0 6px 20px rgba(0, 155, 138, 0.4);
}
</style>
