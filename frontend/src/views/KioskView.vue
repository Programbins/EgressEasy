<template>
  <div class="kiosk-container">
    <div class="map-section" @click.self="deselectSeat">
      <RouteMap 
        ref="routeMap" 
        :reservations="reservations"
        :selected-seat="selectedSeat"
        :highlighted-path="highlightedPath"
        initial-hide-selector='[id^="d"], [id^="D"], [id^="DL"], [id^="SD"], [id^="S"]'
        @node-click="handleNodeClick" 
      />
    </div>
    <div class="panel-section">
      <div v-if="!paymentCompleted">
        <div v-if="selectedSeatInfo.id">
          <div v-if="selectedSeatInfo.isReserved" class="reserved-info">
            <p><strong>이미 예약된 좌석입니다.</strong> (사용자: {{ selectedSeatInfo.username }})</p>
          </div>
          <div v-else class="selection-controls">
            <div class="pricing-plans">
              <button 
                v-for="plan in plans" 
                :key="plan.hours"
                :class="{ selected: selectedPlan && selectedPlan.hours === plan.hours }"
                @click="selectPlan(plan)">
                {{ plan.hours }}시간 <span class="price">({{ formatPrice(plan.price) }}원)</span>
              </button>
            </div>
            <button v-if="selectedPlan" class="payment-button" @click="processPayment">
              {{ finalPrice.toLocaleString() }}원 결제하기
            </button>
          </div>
        </div>
        <div v-else class="prompt-message">
          <p>지도에서 원하시는 좌석을 선택해주세요.</p>
        </div>
      </div>
      <div v-else class="payment-complete-message">
        <h2>결제 완료!</h2>
        <p>좌석({{ finalSeat }})까지의 경로가 지도에 표시됩니다.</p>
        <p class="guidance-message">좌석까지의 경로입니다. 대피 시 해당 경로의 반대로 가시면 됩니다.</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import axios from 'axios';
import RouteMap from '../components/RouteMap.vue';

const selectedSeat = ref(null);
const selectedPlan = ref(null);
const paymentCompleted = ref(false);
const reservations = ref([]);
const currentUser = ref({ username: null, startNode: null });
const highlightedPath = ref([]);
const finalSeat = ref(null);
const finalPlan = ref(null);

const plans = ref([
  { hours: 1, price: 1000, discount: 0 },
  { hours: 3, price: 3000, discount: 0.1 },
  { hours: 5, price: 5000, discount: 0.1 },
  { hours: 10, price: 10000, discount: 0.1 }
]);

onMounted(async () => {
  try {
    const [meRes, reservationsRes] = await Promise.all([
      axios.get('/api/me'),
      axios.get('/api/reservations')
    ]);
    currentUser.value = meRes.data;
    reservations.value = reservationsRes.data;
  } catch (error) {
    console.error('Failed to fetch initial data:', error);
    if (error.response && error.response.status === 401) {
      alert('로그인이 필요합니다.');
    }
  }
});

const selectedSeatInfo = computed(() => {
  if (!selectedSeat.value) return {};
  const reservation = reservations.value.find(r => r.seatId === selectedSeat.value);
  return reservation ? { id: selectedSeat.value, isReserved: true, ...reservation } : { id: selectedSeat.value, isReserved: false };
});

const finalPrice = computed(() => {
  if (!selectedPlan.value) return 0;
  return selectedPlan.value.price * (1 - selectedPlan.value.discount);
});

const handleNodeClick = (nodeId) => {
  if (nodeId && nodeId.startsWith('N')) {
    selectedSeat.value = nodeId;
    selectedPlan.value = null;
  }
};

const deselectSeat = () => {
  selectedSeat.value = null;
  selectedPlan.value = null;
};

const selectPlan = (plan) => {
  selectedPlan.value = plan;
};

const processPayment = async () => {
  if (!selectedSeat.value || !selectedPlan.value) return;
  try {
    await axios.post('/api/reservations', {
      seatId: selectedSeat.value,
      plan: selectedPlan.value,
      username: currentUser.value.username
    });
    const endNode = `D${selectedSeat.value.substring(1)}`;
    const pathRes = await axios.post('/api/find-path', {
      startNode: currentUser.value.startNode,
      endNode: endNode
    });
    highlightedPath.value = pathRes.data.path;
    finalSeat.value = selectedSeat.value;
    finalPlan.value = selectedPlan.value;
    paymentCompleted.value = true;
  } catch (error) {
    console.error('Payment or pathfinding failed:', error);
    alert(error.response?.data?.message || '오류가 발생했습니다.');
  }
};

const formatPrice = (price) => new Intl.NumberFormat('ko-KR').format(price);
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&display=swap');

:root {
  --primary-color: #009B8A;
  --secondary-color: #f9f9f9;
  --text-color: #333;
  --light-text-color: #fff;
  --border-color: #ddd;
  --panel-bg: #ffffff;
  --reserved-bg: #ffc107;
  --font-family: 'Noto Sans KR', sans-serif;
}

.kiosk-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  background-color: #f4f6f8;
  font-family: var(--font-family);
}

.map-section {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 2rem;
  overflow: hidden;
  position: relative;
}

.panel-section {
  background-color: var(--panel-bg);
  padding: 2rem 2.5rem;
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.08);
  border-top-left-radius: 20px;
  border-top-right-radius: 20px;
  min-height: 180px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  transition: all 0.3s ease;
}

.prompt-message p {
  color: #555;
  font-size: 1.5rem;
  font-weight: 500;
}

.selection-controls {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  width: 100%;
  justify-content: center;
}

.pricing-plans {
  display: flex;
  gap: 1rem;
}

.pricing-plans button, .payment-button {
  padding: 1rem 1.5rem;
  border: 2px solid var(--border-color);
  background-color: var(--secondary-color);
  color: var(--text-color);
  cursor: pointer;
  transition: all 0.3s ease;
  border-radius: 12px;
  font-size: 1.1rem;
  font-weight: 500;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}

.pricing-plans button:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0,0,0,0.1);
}

.pricing-plans button.selected {
  background-color: var(--primary-color);
  color: var(--light-text-color);
  border-color: var(--primary-color);
  font-weight: 700;
  transform: translateY(-2px);
  box-shadow: 0 4px 10px rgba(0, 155, 138, 0.3);
}

.price {
  font-size: 0.9em;
  font-weight: 400;
  opacity: 0.8;
}

.payment-button {
  font-size: 1.3rem;
  font-weight: 700;
  color: var(--light-text-color);
  background-color: var(--primary-color);
  border: none;
  box-shadow: 0 4px 15px rgba(0, 155, 138, 0.4);
}

.payment-button:hover {
  background-color: #007a6e;
  transform: translateY(-2px);
}

.reserved-info {
  padding: 1rem 1.5rem;
  background-color: #ffeaa7;
  border-radius: 12px;
  color: #d35400;
  font-size: 1.2rem;
  font-weight: 500;
  text-align: center;
}

.payment-complete-message {
  text-align: center;
}

.payment-complete-message h2 {
  color: var(--primary-color);
  font-size: 2rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
}

.payment-complete-message p {
  font-size: 1.2rem;
  color: #555;
}

.guidance-message {
  margin-top: 1rem;
  font-size: 1rem;
  color: #e74c3c;
  font-weight: 500;
}
</style>