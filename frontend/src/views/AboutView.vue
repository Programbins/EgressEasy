<template>
  <div class="about">
    <div class="content-wrapper">
      <h1>This is an about page</h1>
    </div>
  </div>
</template>

<style scoped>
.about {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  text-align: center;
  padding: 2rem;
  background-color: #f4f6f8;
}

.content-wrapper {
  background: white;
  padding: 4rem;
  border-radius: 15px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
  text-align: center;
}

h1 {
  color: #333;
  font-size: 2.5rem;
  font-weight: 700;
}
</style>
