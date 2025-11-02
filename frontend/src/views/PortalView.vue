<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import axios from 'axios';
import RouteMap from '../components/RouteMap.vue';

const router = useRouter();
const exitParam = ref('');
const isAuthorized = ref(false);
const errorMessage = ref('');

const locationText = computed(() => exitParam.value ? `${exitParam.value}번 비상구` : '위치 식별 중...');

// Correctly compute the node ID to be animated
const exitNodeId = computed(() => exitParam.value ? `E${exitParam.value}` : '');

// Define the selector for elements to hide initially
const hideSelector = '[id^="d"], [id^="D"], [id^="DL"], [id^="SD"], [id^="S"]';

const checkStatus = async () => {
  try {
    const response = await axios.get('/api/status');
    // locationText.value = response.data.location; // Removed this line
    exitParam.value = response.data.exit_param;

    if (response.data.status === 'authorized') {
      isAuthorized.value = true;
    }
  } catch (error) {
    console.error('Error checking status:', error);
    errorMessage.value = '상태 확인 중 오류가 발생했습니다.';
  }
};

const connectAndRedirect = async () => {
  try {
    await axios.post('/api/connect-long');
    isAuthorized.value = true;
    router.push('/done');
  } catch (error) {
    console.error('Error during authorization:', error);
    errorMessage.value = '24시간 인증에 실패했습니다. 관리자에게 문의하세요.';
    router.push('/error');
  }
};

const goToLogin = () => {
  router.push('/login');
};

onMounted(() => {
  checkStatus();
});
</script>

<template>
  <div class="portal-container">
    <div class="map-wrapper">
      <RouteMap 
        :initial-hide-selector="hideSelector" 
        :animate-node-id="exitNodeId" 
      />
    </div>
    <div class="content-wrapper">
      <h2>비상 안내<br>키오스크</h2>
      <p>현재 위치는 <b>{{ locationText }}</b> 입니다.</p>

      <div class="button-group">
        <button @click="connectAndRedirect" :disabled="isAuthorized">인터넷 연결하기</button>
        <button @click="goToLogin">키오스크 시작</button>
      </div>

      <p v-if="isAuthorized" class="status-message">이미 24시간 연결되었습니다. 인터넷을 자유롭게 사용하세요.</p>
      <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>
    </div>
  </div>
</template>

<style scoped>
.portal-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start; /* Align items to the top */
  min-height: 100vh;
  text-align: center;
  padding: 2rem;
  background-color: #f4f6f8;
  color: #333;
}

.map-wrapper {
  width: 100%;
  max-width: 600px;
  height: 300px;
  margin-bottom: 2rem;
  border-radius: 15px;
  overflow: hidden;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
}

.content-wrapper {
  width: 100%;
  max-width: 600px;
  background: white;
  padding: 2.5rem;
  border-radius: 15px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
}

h2 {
  color: #333;
  margin-bottom: 1rem;
  font-size: 2.2rem;
  font-weight: 700;
}

p {
  margin-bottom: 1.5rem;
  font-size: 1.2rem;
  color: #555;
}

b {
  color: #009B8A;
  font-weight: 700;
}

.button-group {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-top: 1rem;
  width: 100%;
}

button {
  padding: 1rem 1.5rem;
  width: 100%;
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

button:hover:not(:disabled) {
  background-color: #007a6e;
  transform: translateY(-3px);
  box-shadow: 0 6px 20px rgba(0, 155, 138, 0.4);
}

button:disabled {
  background-color: #bdc3c7;
  cursor: not-allowed;
  box-shadow: none;
  transform: none;
}

.status-message {
  margin-top: 1.5rem;
  color: #27ae60;
  font-weight: 500;
  font-size: 1.1rem;
}

.error-message {
  margin-top: 1.5rem;
  color: #e74c3c;
  font-weight: 500;
  font-size: 1.1rem;
}
</style>