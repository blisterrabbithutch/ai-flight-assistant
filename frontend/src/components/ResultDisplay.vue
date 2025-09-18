<template>
	<!-- Result for irrelevant questions (no flight data needed) -->
	<div v-if="result && !result.error && isIrrelevantQuestion" class="result-container">
		<Card class="result-card">
			<template #title>
				<div class="result-title">
					<i class="pi pi-info-circle"></i>
					Response for {{ result.airportName }} ({{ result.airport }})
				</div>
			</template>

			<template #content>
				<div class="result-content">
					<!-- Question Section -->
					<div class="question-section">
						<h4>
							<i class="pi pi-question-circle"></i>
							Your Question
						</h4>
						<p class="question-text">{{ result.question }}</p>
					</div>

					<Divider />

					<!-- AI Answer Section -->
					<div class="answer-section">
						<h4>
							<i class="pi pi-lightbulb"></i>
							AI Response
						</h4>
						<div class="answer-text" v-html="formatAnswer(result.answer)"></div>
					</div>

					<Divider />

					<!-- Analysis Info -->
					<div class="analysis-info">
						<h4>
							<i class="pi pi-cog"></i>
							Analysis Details
						</h4>
						<div class="analysis-grid">
							<div class="analysis-item">
								<span class="analysis-label">Question Relevance:</span>
								<Badge value="Not Aviation Related" severity="warning" />
							</div>
							<div class="analysis-item">
								<span class="analysis-label">Reasoning:</span>
								<span class="analysis-value">{{ result.analysis.reasoning }}</span>
							</div>
							<div class="analysis-item">
								<span class="analysis-label">FlightAPI Called:</span>
								<Badge value="No" severity="secondary" />
							</div>
							<div class="analysis-item">
								<span class="analysis-label">Response Time:</span>
								<span class="analysis-value">{{ result.metadata.responseTime }}</span>
							</div>
						</div>
					</div>
				</div>
			</template>
		</Card>
	</div>

	<!-- Regular result with flight data -->
	<div v-else-if="result && !result.error && hasFlightData" class="result-container">
		<Card class="result-card">
			<template #title>
				<div class="result-title">
					<i class="pi pi-check-circle"></i>
					Analysis for {{ result.airportName }} ({{ result.airport }})
				</div>
			</template>

			<template #content>
				<div class="result-content">
					<!-- Question Section -->
					<div class="question-section">
						<h4>
							<i class="pi pi-question-circle"></i>
							Your Question
						</h4>
						<p class="question-text">{{ result.question }}</p>
					</div>

					<Divider />

					<!-- AI Answer Section -->
					<div class="answer-section">
						<h4>
							<i class="pi pi-lightbulb"></i>
							AI Analysis
						</h4>
						<div class="answer-text" v-html="formatAnswer(result.answer)"></div>
					</div>

					<Divider />

					<!-- Flight Data Summary -->
					<div class="data-summary">
						<h4>
							<i class="pi pi-chart-bar"></i>
							Flight Data Summary
						</h4>
						<div class="summary-grid">
							<div class="summary-item">
								<i class="pi pi-arrow-down text-green-600"></i>
								<span class="summary-label">Total Arrivals</span>
								<Badge :value="result.data.summary.totalArrivals" severity="success" />
							</div>
							<div class="summary-item">
								<i class="pi pi-arrow-up text-blue-600"></i>
								<span class="summary-label">Total Departures</span>
								<Badge :value="result.data.summary.totalDepartures" severity="info" />
							</div>
							<div class="summary-item">
								<i class="pi pi-globe text-purple-600"></i>
								<span class="summary-label">Arrival Countries</span>
								<Badge :value="result.data.summary.arrivalCountries" severity="help" />
							</div>
							<div class="summary-item">
								<i class="pi pi-map-marker text-orange-600"></i>
								<span class="summary-label">Departure Countries</span>
								<Badge :value="result.data.summary.departureCountries" severity="warning" />
							</div>
							<div class="summary-item">
								<i class="pi pi-building text-indigo-600"></i>
								<span class="summary-label">Unique Airlines</span>
								<Badge :value="result.data.summary.uniqueAirlines" />
							</div>
							<div class="summary-item">
								<i class="pi pi-map text-teal-600"></i>
								<span class="summary-label">Total Cities</span>
								<Badge :value="result.data.summary.arrivalCities + result.data.summary.departureCities"
									severity="secondary" />
							</div>
						</div>
					</div>

					<!-- Top Countries -->
					<div v-if="result.data.arrivals.topCountries.length > 0" class="top-countries-section">
						<h4>
							<i class="pi pi-flag"></i>
							Top Countries (Arrivals)
						</h4>
						<div class="countries-grid">
							<div v-for="country in result.data.arrivals.topCountries.slice(0, 8)" :key="country.country"
								class="country-item">
								<span class="country-name">{{ country.country }}</span>
								<Badge :value="country.count" />
							</div>
						</div>
					</div>

					<!-- Top Airlines -->
					<div v-if="result.data.arrivals.topAirlines.length > 0" class="airlines-section">
						<h4>
							<i class="pi pi-plane"></i>
							Airlines (Arrivals)
						</h4>
						<div class="airline-chips">
							<Chip v-for="airline in result.data.arrivals.topAirlines.slice(0, 10)" :key="airline"
								:label="airline" class="airline-chip" />
						</div>
					</div>

					<!-- Metadata -->
					<div class="metadata-section">
						<div class="metadata-grid">
							<div class="metadata-item">
								<i class="pi pi-clock"></i>
								<span>Response Time: {{ result.metadata.responseTime }}</span>
							</div>
							<div class="metadata-item">
								<i class="pi pi-database"></i>
								<span>Data Source: {{ result.metadata.dataSource }}</span>
							</div>
							<div class="metadata-item">
								<i class="pi pi-brain"></i>
								<span>AI Model: {{ result.metadata.aiModel }}</span>
							</div>
							<div class="metadata-item">
								<i class="pi pi-calendar"></i>
								<span>Generated: {{ formatTimestamp(result.metadata.timestamp) }}</span>
							</div>
						</div>
					</div>
				</div>
			</template>
		</Card>
	</div>

	<!-- Error Display -->
	<div v-else-if="result && result.error" class="error-container">
		<Message severity="error" class="error-message">
			<div class="error-content">
				<h4>Unable to Process Request</h4>
				<p>{{ result.error }}</p>
				<small>Please try again with a different question or airport.</small>
			</div>
		</Message>
	</div>
</template>

<script setup>
import { computed } from 'vue'

// Props
const props = defineProps({
	result: {
		type: Object,
		default: null
	}
})

// Format AI answer with HTML
const formatAnswer = (answer) => {
	if (!answer) return ''

	return answer
		.replace(/\n/g, '<br>')
		.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
		.replace(/\*(.*?)\*/g, '<em>$1</em>')
		.replace(/`(.*?)`/g, '<code>$1</code>')
		.replace(/(\d+)/g, '<span class="number-highlight">$1</span>')
}

const formatTimestamp = (timestamp) => {
	return new Date(timestamp).toLocaleString()
}

const hasFlightData = computed(() => {
	return props.result &&
		props.result.data &&
		props.result.data.summary
})

const isIrrelevantQuestion = computed(() => {
	return props.result &&
		props.result.analysis &&
		props.result.analysis.relevant === false
})
</script>

<style scoped>
.result-container {
	margin-top: 2rem;
	animation: fadeInUp 0.6s ease-out;
}

@keyframes fadeInUp {
	from {
		opacity: 0;
		transform: translateY(30px);
	}

	to {
		opacity: 1;
		transform: translateY(0);
	}
}

.result-card {
	max-width: 900px;
	margin: 0 auto;
	box-shadow: 0 15px 50px rgba(0, 0, 0, 0.1);
}

.result-title {
	display: flex;
	align-items: center;
	gap: 0.75rem;
	color: #059669;
	font-size: 1.4rem;
	font-weight: 600;
}

.result-content {
	display: flex;
	flex-direction: column;
	gap: 1.5rem;
}

.question-section h4,
.answer-section h4,
.data-summary h4,
.top-countries-section h4,
.airlines-section h4 {
	color: #374151;
	margin: 0 0 1rem 0;
	font-size: 1.1rem;
	font-weight: 600;
	display: flex;
	align-items: center;
	gap: 0.5rem;
}

.question-section {
	background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
	padding: 1.5rem;
	border-radius: 12px;
	border-left: 4px solid #3b82f6;
}

.question-text {
	font-style: italic;
	color: #4b5563;
	font-size: 1.05rem;
	margin: 0;
	line-height: 1.6;
}

.answer-section {
	background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
	padding: 1.5rem;
	border-radius: 12px;
	border-left: 4px solid #10b981;
}

.answer-text {
	line-height: 1.8;
	color: #065f46;
	font-size: 1rem;
}

.answer-text :deep(strong) {
	color: #047857;
	font-weight: 600;
}

.answer-text :deep(em) {
	color: #059669;
}

.answer-text :deep(code) {
	background: rgba(16, 185, 129, 0.1);
	padding: 0.2em 0.4em;
	border-radius: 4px;
	font-family: 'Monaco', 'Menlo', monospace;
	font-size: 0.9em;
}

.answer-text :deep(.number-highlight) {
	font-weight: 600;
	color: #0f766e;
}

.data-summary {
	background: #fafafa;
	padding: 1.5rem;
	border-radius: 12px;
	border: 1px solid #e5e7eb;
}

.summary-grid {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
	gap: 1rem;
}

.summary-item {
	display: flex;
	align-items: center;
	gap: 0.75rem;
	padding: 1rem;
	background: white;
	border-radius: 10px;
	box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
	transition: all 0.3s ease;
}

.summary-item:hover {
	transform: translateY(-2px);
	box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}

.summary-item i {
	font-size: 1.2rem;
	width: 20px;
	text-align: center;
}

.summary-label {
	font-weight: 500;
	color: #374151;
	flex: 1;
}

.top-countries-section,
.airlines-section {
	background: #fefefe;
	padding: 1.5rem;
	border-radius: 12px;
	border: 1px solid #f3f4f6;
}

.countries-grid {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
	gap: 0.75rem;
}

.country-item {
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: 0.75rem 1rem;
	background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
	border-radius: 8px;
	border: 1px solid #93c5fd;
}

.country-name {
	font-weight: 500;
	color: #1e40af;
}

.airline-chips {
	display: flex;
	flex-wrap: wrap;
	gap: 0.5rem;
}

.airline-chip {
	background: #e0f2fe;
	color: #0e7490;
	border: 1px solid #bae6fd;
}

.metadata-section {
	margin-top: 1rem;
	padding-top: 1rem;
	border-top: 1px solid #e5e7eb;
}

.metadata-grid {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
	gap: 0.75rem;
}

.metadata-item {
	display: flex;
	align-items: center;
	gap: 0.5rem;
	font-size: 0.9rem;
	color: #6b7280;
}

.metadata-item i {
	color: #9ca3af;
}

.analysis-info {
	background: #fefefe;
	padding: 1.5rem;
	border-radius: 12px;
	border: 1px solid #f3f4f6;
}

.analysis-grid {
	display: grid;
	grid-template-columns: 1fr;
	gap: 1rem;
}

.analysis-item {
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: 0.75rem 1rem;
	background: white;
	border-radius: 8px;
	box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.analysis-label {
	font-weight: 500;
	color: #374151;
}

.analysis-value {
	color: #6b7280;
	font-size: 0.9rem;
	max-width: 60%;
	text-align: right;
}

.error-container {
	margin-top: 2rem;
	max-width: 600px;
	margin-left: auto;
	margin-right: auto;
}

.error-message {
	border-radius: 12px;
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

/* Color utilities */
.text-green-600 {
	color: #059669;
}

.text-blue-600 {
	color: #2563eb;
}

.text-purple-600 {
	color: #9333ea;
}

.text-orange-600 {
	color: #ea580c;
}

.text-indigo-600 {
	color: #4f46e5;
}

.text-teal-600 {
	color: #0d9488;
}

/* Responsive design */
@media (max-width: 768px) {
	.summary-grid {
		grid-template-columns: 1fr;
	}

	.countries-grid {
		grid-template-columns: 1fr;
	}

	.metadata-grid {
		grid-template-columns: 1fr;
	}

	.analysis-grid {
		grid-template-columns: 1fr;
	}

	.analysis-value {
		max-width: 100%;
		text-align: left;
		margin-top: 0.25rem;
	}

	.analysis-item {
		flex-direction: column;
		align-items: flex-start;
	}

	.question-section,
	.answer-section,
	.data-summary,
	.top-countries-section,
	.airlines-section {
		padding: 1rem;
	}
}

@media (max-width: 480px) {
	.result-title {
		font-size: 1.2rem;
		flex-direction: column;
		text-align: center;
		gap: 0.5rem;
	}

	.airline-chips {
		justify-content: center;
	}
}
</style>
