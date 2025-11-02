<template>
  <div class="auth-container">
    <form @submit.prevent="handleLogin" class="auth-form">
      <h2>키오스크 로그인</h2>
      <div class="form-group">
        <label for="username">아이디</label>
        <input type="text" v-model="username" id="username" required>
      </div>
      <div class="form-group">
        <label for="password">비밀번호</label>
        <input type="password" v-model="password" id="password" required>
      </div>
      <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>
      <button type="submit" class="submit-btn">로그인</button>
      <div class="links">
        <router-link to="/signup">회원가입</router-link>
        <span>|</span>
        <a href="#" @click.prevent="findId">아이디 찾기</a>
      </div>
    </form>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import axios from 'axios';

const router = useRouter();
const username = ref('');
const password = ref('');
const errorMessage = ref('');

const handleLogin = async () => {
  try {
    await axios.post('/api/login', {
      username: username.value,
      password: password.value
    });
    // On successful login, open the kiosk in a new tab and go to done page in current tab
    window.open('/kiosk', '_blank');
    router.push('/done');
  } catch (error) {
    console.error('Login failed:', error);
    if (error.response && error.response.status === 401) {
      errorMessage.value = '아이디 또는 비밀번호가 일치하지 않습니다.';
    } else {
      errorMessage.value = '로그인 중 오류가 발생했습니다.';
    }
  }
};

const findId = () => {
  alert('아이디 찾기 기능은 현재 지원되지 않습니다.');
};
</script>

<style scoped>
.auth-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background-color: #f4f6f8;
}
.auth-form {
  background: white;
  padding: 3rem;
  border-radius: 15px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
  width: 100%;
  max-width: 420px;
  text-align: center;
  transition: all 0.3s ease;
}
.auth-form:hover {
  transform: translateY(-5px);
  box-shadow: 0 15px 35px rgba(0, 0, 0, 0.12);
}
h2 {
  margin-bottom: 2rem;
  color: #333;
  font-weight: 700;
  font-size: 2rem;
}
.form-group {
  margin-bottom: 1.5rem;
  text-align: left;
}
label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: #555;
}
input {
  width: 100%;
  padding: 0.8rem 1rem;
  border: 2px solid #ddd;
  border-radius: 8px;
  box-sizing: border-box;
  font-size: 1rem;
  transition: border-color 0.3s ease;
}
input:focus {
  outline: none;
  border-color: #009B8A;
}
.error-message {
  color: #e74c3c;
  margin-bottom: 1.5rem;
  font-weight: 500;
}
.submit-btn {
  width: 100%;
  padding: 1rem;
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
.submit-btn:hover {
  background-color: #007a6e;
  transform: translateY(-3px);
  box-shadow: 0 6px 20px rgba(0, 155, 138, 0.4);
}
.links {
  margin-top: 1.5rem;
  display: flex;
  justify-content: center;
  gap: 1rem;
  color: #777;
}
.links a {
  color: #009B8A;
  text-decoration: none;
  font-weight: 500;
  transition: color 0.3s ease;
}
.links a:hover {
  color: #007a6e;
  text-decoration: underline;
}
</style>
