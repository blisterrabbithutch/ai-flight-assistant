<template>
  <Card class="flight-form-card">
    <template #title>
      <div class="form-title">
        <i class="pi pi-send"></i>
        Ask About Flight Data
      </div>
    </template>
    
    <template #content>
      <form @submit.prevent="handleSubmit" class="flight-form">
        <!-- Airport Selection -->
        <div class="form-field">
          <label for="airport" class="form-label">Select Airport</label>
          <Dropdown
            id="airport"
            v-model="selectedAirport"
            :options="airports"
            optionLabel="label"
            optionValue="code"
            placeholder="Choose an airport..."
            class="w-full"
            :class="{ 'p-invalid': errors.airport }"
          >
            <template #option="{ option }">
              <div class="airport-option">
                <span class="airport-code">{{ option.code }}</span>
                <span class="airport-name">{{ option.name }}</span>
              </div>
            </template>
          </Dropdown>
          <small v-if="errors.airport" class="p-error">{{ errors.airport }}</small>
        </div>

        <!-- Question Input -->
        <div class="form-field">
          <label for="question" class="form-label">Your Question</label>
          <Textarea
            id="question"
            v-model="question"
            placeholder="e.g., How many flights arrived from Germany? Which countries have the most departing flights?"
            :rows="4"
            class="w-full"
            :class="{ 'p-invalid': errors.question }"
            :maxlength="500"
          />
          <div class="question-help">
            <small class="help-text">
              Ask questions about flight arrivals, departures, countries, airlines, or specific routes.
            </small>
            <small class="char-count">{{ question.length }}/500</small>
          </div>
          <small v-if="errors.question" class="p-error">{{ errors.question }}</small>
        </div>

        <!-- Date Selection (Optional) -->
        <div class="form-field">
          <label for="date" class="form-label">Date (Optional)</label>
          <Dropdown
            id="date"
            v-model="selectedDate"
            :options="dateOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="Today (default)"
            class="w-full"
            :showClear="true"
          />
          <small class="help-text">Select date for flight data (default: Today)</small>
        </div>

        <!-- Example Questions -->
        <div class="example-questions">
          <h4>Example Questions:</h4>
          <div class="example-chips">
            <Chip
              v-for="example in exampleQuestions"
              :key="example"
              :label="example"
              class="example-chip"
              @click="selectExample(example)"
            />
          </div>
        </div>

        <!-- Submit Button -->
        <div class="form-actions">
          <Button
            type="submit"
            :label="loading ? 'Analyzing...' : 'Ask Question'"
            icon="pi pi-search"
            :loading="loading"
            :disabled="loading || !canSubmit"
            class="submit-button"
            size="large"
          />
        </div>
      </form>
    </template>
  </Card>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useToast } from 'primevue/usetoast'
import apiService from '../services/api.js'

const emit = defineEmits(['submit', 'loading'])

const toast = useToast()

const selectedAirport = ref('')
const question = ref('')
const selectedDate = ref(null)
const loading = ref(false)
const errors = ref({})

// Airport options - можно заменить на API запрос. если успею
const airports = ref([
  { code: 'DXB', name: 'Dubai International Airport', label: 'DXB - Dubai International Airport' },
  { code: 'LHR', name: 'London Heathrow Airport', label: 'LHR - London Heathrow Airport' },
  { code: 'CDG', name: 'Charles de Gaulle Airport (Paris)', label: 'CDG - Charles de Gaulle Airport (Paris)' },
  { code: 'SIN', name: 'Singapore Changi Airport', label: 'SIN - Singapore Changi Airport' },
  { code: 'HKG', name: 'Hong Kong International Airport', label: 'HKG - Hong Kong International Airport' },
  { code: 'AMS', name: 'Amsterdam Airport Schiphol', label: 'AMS - Amsterdam Airport Schiphol' }
])

// Date options
const dateOptions = ref([
  { label: 'Yesterday', value: -1 },
  { label: 'Today', value: 1 },
  { label: 'Tomorrow', value: 2 }
])

// Example questions
const exampleQuestions = ref([
  'How many flights arrived from Germany?',
  'Which countries have the most departing flights?',
  'What airlines operate from the US?',
  'How many flights go to Asian countries?',
  'Which cities in France have direct flights?'
])

// Simple submit validation (можно воткнуть vuelidate мб)
const canSubmit = computed(() => {
  return selectedAirport.value && 
         question.value.trim().length >= 5 && 
         question.value.trim().length <= 500
})

// Validation
const validateForm = () => {
  errors.value = {}

  if (!selectedAirport.value) {
    errors.value.airport = 'Please select an airport'
  }

  if (!question.value.trim()) {
    errors.value.question = 'Please enter a question'
  } else if (question.value.trim().length < 5) {
    errors.value.question = 'Question must be at least 5 characters long'
  } else if (question.value.trim().length > 500) {
    errors.value.question = 'Question must be less than 500 characters'
  }

  return Object.keys(errors.value).length === 0
}

// Select example question
const selectExample = (example) => {
  question.value = example
}

// Handle form submission
const handleSubmit = async () => {
  if (!validateForm()) {
    toast.add({
      severity: 'warn',
      summary: 'Form Validation',
      detail: 'Please fill in all required fields correctly',
      life: 3000
    })
    return
  }

  loading.value = true
  emit('loading', true)

  // Show info toast when starting
  toast.add({
    severity: 'info',
    summary: 'Processing Request',
    detail: `Analyzing flight data for ${selectedAirport.value}...`,
    life: 2000
  })

  try {
    const result = await apiService.queryFlights(
      selectedAirport.value,
      question.value.trim(),
      selectedDate.value || 1 // Default to today (1) if nothing selected
    )

    emit('submit', result)
  } catch (error) {
    console.error('Form submission error:', error)
    // Error will be handled by parent component
    emit('submit', { error: error.message })
  } finally {
    loading.value = false
    emit('loading', false)
  }
}


// Expose methods for parent component
defineExpose({
  setLoading: (value) => {
    loading.value = value
  },
  clearForm: () => {
    selectedAirport.value = ''
    question.value = ''
    selectedDate.value = null
    errors.value = {}
  }
})
</script>

<style scoped>
.flight-form-card {
  max-width: 900px;
  margin: 0 auto;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
}

.form-title {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 1.5rem;
  font-weight: 600;
}

.flight-form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-label {
  font-weight: 500;
  color: #374151;
  font-size: 0.95rem;
}

.airport-option {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.airport-code {
  font-weight: 600;
  min-width: 40px;
}

.airport-name {
  color: #6b7280;
  font-size: 0.9rem;
}

.question-help {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 0.25rem;
}

.help-text {
  color: #6b7280;
  font-size: 0.85rem;
}

.char-count {
  color: #9ca3af;
  font-size: 0.8rem;
  font-weight: 500;
}

.example-questions {
  margin-top: 0.5rem;
}

.example-questions h4 {
  color: #374151;
  font-size: 0.9rem;
  margin-bottom: 0.75rem;
  font-weight: 500;
}

.example-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.example-chip {
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 0.8rem;
}

.example-chip:hover {
  background: #dbeafe;
  color: #1e40af;
  transform: translateY(-1px);
}

.form-actions {
  display: flex;
  justify-content: center;
  margin-top: 1rem;
}

.form-actions > * {
  width: 100%;
}

.submit-button {
  min-width: 200px;
  font-size: 1.05rem;
  padding: 0.875rem 2rem;
}

.p-error {
  color: #dc2626;
  font-size: 0.875rem;
  margin-top: 0.25rem;
}

.p-invalid {
  border-color: #dc2626 !important;
}

.w-full {
  width: 100%;
}

@media (max-width: 768px) {
  .flight-form-card {
    margin: 0 0.5rem;
  }

  .example-chips {
    flex-direction: column;
  }

  .example-chip {
    align-self: flex-start;
  }

  .question-help {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.25rem;
  }

  .submit-button {
    width: 100%;
  }
}
</style>
