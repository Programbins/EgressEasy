<template>
  <div class="done-container">
    <div class="content-wrapper">
      <h3>연결 완료! 인터넷을 자유롭게 사용하세요.</h3>
      <p>안전한 이용 바랍니다.</p>
    </div>
  </div>
</template>

<script setup>
// No specific logic needed for this simple view
</script>

<style scoped>
.done-container {
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
  color: #009B8A;
  margin-bottom: 1rem;
  font-size: 2.5rem;
  font-weight: 700;
}

p {
  color: #555;
  font-size: 1.2rem;
  font-weight: 500;
}
</style>
