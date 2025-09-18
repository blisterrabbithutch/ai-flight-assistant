import { createApp } from 'vue'
import PrimeVue from 'primevue/config'
import Aura from '@primeuix/themes/aura';
import App from './App.vue'

import Button from 'primevue/button'
import Dropdown from 'primevue/dropdown'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import Card from 'primevue/card'
import ProgressSpinner from 'primevue/progressspinner'
import Divider from 'primevue/divider'
import Badge from 'primevue/badge'
import Message from 'primevue/message'
import Chip from 'primevue/chip'
import Toast from 'primevue/toast'
import ToastService from 'primevue/toastservice'

import 'primeicons/primeicons.css'

import './style.css'

const app = createApp(App)

app.use(PrimeVue, {
  theme: {
      preset: Aura
  }
});

app.use(ToastService)

app.component('Button', Button)
app.component('Dropdown', Dropdown)
app.component('InputText', InputText)
app.component('Textarea', Textarea)
app.component('Card', Card)
app.component('ProgressSpinner', ProgressSpinner)
app.component('Divider', Divider)
app.component('Badge', Badge)
app.component('Message', Message)
app.component('Chip', Chip)
app.component('Toast', Toast)

app.mount('#app')

setTimeout(() => {
  document.body.classList.add('app-loaded')
}, 100)
