import './assets/main.css'

import { createApp } from 'vue'

import App from './App.vue'

import router from './router.js'
import VueApexCharts from "vue3-apexcharts";

// Toast notifications
import Toast from "vue-toastification";
import "vue-toastification/dist/index.css";
import "./assets/toast.css"; // Custom toast styling

const app = createApp(App)

app.use(router)
app.use(VueApexCharts)

// Toast configuration
app.use(Toast, {
  position: "top-right",
  timeout: 9000,
  closeOnClick: true,
  pauseOnFocusLoss: true,
  pauseOnHover: true,
  draggable: true,
  draggablePercent: 0.6,
  showCloseButtonOnHover: false,
  hideProgressBar: false,
  closeButton: "button",
  icon: true,
  rtl: false,
  transition: "Vue-Toastification__bounce",
  maxToasts: 5,
  newestOnTop: true
});

app.mount('#app')
