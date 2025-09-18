<template>
	<div id="app">
		<main class="app-main">
			<div class="container">
				<FlightForm ref="flightFormRef" @submit="handleQuery" @loading="handleLoading" />

				<div v-if="loading && currentStep !== 0" class="loading-container">
					<ProgressSpinner strokeWidth="3" />
					<div class="loading-content">
						<h3 class="loading-title">Analyzing Flight Data</h3>
						<p class="loading-text">{{ loadingMessage }}</p>
						<div class="loading-steps">
							<div class="step" :class="{ active: currentStep >= 1 }">
								<i class="pi pi-database"></i>
								<span>Fetching flight data</span>
							</div>
							<div class="step" :class="{ active: currentStep >= 2 }">
								<i class="pi pi-cog"></i>
								<span>Processing information</span>
							</div>
							<div class="step" :class="{ active: currentStep >= 3 }">
								<i class="pi pi-eye"></i>
								<span>Generating AI analysis</span>
							</div>
						</div>
					</div>
				</div>

				<ResultDisplay :result="result" />
			</div>
		</main>

		<Toast position="top-right" />
	</div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useToast } from 'primevue/usetoast'
import FlightForm from './components/FlightForm.vue'
import ResultDisplay from './components/ResultDisplay.vue'

const toast = useToast()

const flightFormRef = ref(null)
const loading = ref(false)
const result = ref(null)
const currentStep = ref(0)
const loadingMessage = ref('Preparing your request...')

const handleQuery = async (queryResult) => {
	result.value = null

	if (queryResult.error) {
		toast.add({
			severity: 'error',
			summary: 'Request Failed',
			detail: queryResult.error,
			life: 5000
		})
		return
	}

	result.value = queryResult

	toast.add({
		severity: 'success',
		summary: 'Analysis Complete',
		detail: `Successfully analyzed flight data for ${queryResult.airport}`,
		life: 3000
	})
}

const handleLoading = (isLoading) => {
	loading.value = isLoading

	if (isLoading) {
		currentStep.value = 0
		startLoadingSequence()
	} else {
		currentStep.value = 0
		loadingMessage.value = 'Preparing your request...'
	}
}

const startLoadingSequence = () => {
	const steps = [
		{ step: 1, message: 'Fetching flight data from FlightAPI.io...', delay: 500 },
		{ step: 2, message: 'Processing flight information...', delay: 1500 },
		{ step: 3, message: 'Generating AI analysis with Gemini Flash...', delay: 2500 }
	]

	steps.forEach(({ step, message, delay }) => {
		setTimeout(() => {
			if (loading.value) {
				currentStep.value = step
				loadingMessage.value = message
			}
		}, delay)
	})
}

// Initialize app
onMounted(() => {
	// welcome message
	setTimeout(() => {
		toast.add({
			severity: 'info',
			summary: 'Welcome to Flight Assistant AI',
			detail: 'Select an airport and ask a question to get started!',
			life: 4000
		})
	}, 1000)
})
</script>

<style>
/* Global app styles are in src/style.css */

.loading-container {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 2rem;
	margin: 3rem 0;
	padding: 3rem 2rem;
	background: rgba(255, 255, 255, 0.1);
	backdrop-filter: blur(15px);
	border-radius: 20px;
	border: 1px solid rgba(255, 255, 255, 0.2);
	box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
}

.loading-content {
	text-align: center;
	color: white;
}

.loading-title {
	font-size: 1.5rem;
	font-weight: 600;
	margin-bottom: 0.5rem;
	color: white;
}

.loading-text {
	font-size: 1.1rem;
	margin-bottom: 2rem;
	opacity: 0.9;
}

.loading-steps {
	display: flex;
	justify-content: center;
	gap: 2rem;
	margin-top: 1rem;
}

.step {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 0.5rem;
	padding: 1rem;
	border-radius: 12px;
	background: rgba(255, 255, 255, 0.1);
	transition: all 0.3s ease;
	opacity: 0.5;
}

.step.active {
	opacity: 1;
	background: rgba(255, 255, 255, 0.2);
	transform: scale(1.05);
}

.step i {
	font-size: 1.5rem;
	color: #fbbf24;
}

.step span {
	font-size: 0.9rem;
	font-weight: 500;
	text-align: center;
}

.quick-stats {
	margin-top: 3rem;
}

.stats-card {
	max-width: 800px;
	margin: 0 auto;
}

.stats-title {
	display: flex;
	align-items: center;
	gap: 0.75rem;
	font-size: 1.3rem;
	font-weight: 600;
}

.airports-showcase {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
	gap: 1rem;
}

.airport-showcase-item {
	display: flex;
	align-items: center;
	gap: 1rem;
	padding: 1.25rem;
	background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
	border-radius: 12px;
	border: 2px solid transparent;
	cursor: pointer;
	transition: all 0.3s ease;
}

.airport-showcase-item:hover {
	border-color: #3b82f6;
	background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
	transform: translateY(-2px);
	box-shadow: 0 8px 25px rgba(59, 130, 246, 0.15);
}

.airport-code {
	font-size: 1.5rem;
	font-weight: 700;
	color: #1e40af;
	min-width: 60px;
}

.airport-info {
	flex: 1;
}

.airport-name {
	font-weight: 600;
	color: #374151;
	margin-bottom: 0.25rem;
}

.airport-location {
	color: #6b7280;
	font-size: 0.9rem;
}

.airport-showcase-item i {
	color: #9ca3af;
	transition: all 0.3s ease;
}

.airport-showcase-item:hover i {
	color: #3b82f6;
	transform: translateX(4px);
}

.error-message {
	max-width: 600px;
	margin: 2rem auto;
}

.error-content h4 {
	margin: 0 0 0.5rem 0;
	color: #dc2626;
}

.error-content p {
	margin: 0.5rem 0;
	color: #7f1d1d;
}

.error-content small {
	color: #991b1b;
}
</style>
