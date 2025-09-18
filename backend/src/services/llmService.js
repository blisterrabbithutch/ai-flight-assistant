import axios from 'axios';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_BASE = process.env.OPENROUTER_BASE_URL;

class LLMService {
	constructor() {
		console.log('OPENROUTER_API_KEY', OPENROUTER_API_KEY);
		console.log('OPENROUTER_BASE', OPENROUTER_BASE);
		this.client = axios.create({
			baseURL: OPENROUTER_BASE,
			timeout: 60000,
			headers: {
				'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
				'Content-Type': 'application/json',
				'HTTP-Referer': 'https://flight-assistant-ai.com', // типа наш урл будет
				'X-Title': 'Flight Assistant AI'
			}
		});

		// Request interceptor
		this.client.interceptors.request.use(
			(config) => {
				console.log(`🤖 LLM Request: ${config.method?.toUpperCase()} ${config.url}`);
				return config;
			},
			(error) => {
				console.error('🚨 LLM Request Error:', error);
				return Promise.reject(error);
			}
		);

		// Response interceptor
		this.client.interceptors.response.use(
			(response) => {
				console.log(`✅ LLM Response: ${response.status}`);
				return response;
			},
			(error) => {
				console.error('🚨 LLM Response Error:', {
					status: error.response?.status,
					message: error.response?.data?.error?.message || error.message,
					url: error.config?.url
				});
				return Promise.reject(error);
			}
		);
	}

	/**
	 * Analyze question to determine FlightAPI mode (arrivals or departures) & aviation topic relevance
	 * @param {string} question - User's question
	 * @param {string} airport - Airport code
	 * @returns {Promise<Object>} Analysis result with mode and reasoning
	 */
	async analyzeQuestionForMode(question, airport) {
		try {
			console.log(`🔍 Analyzing question for FlightAPI mode: "${question}"`);

			const analysisPrompt = `You are a FlightAPI.io integration specialist. Analyze this question to determine if it's aviation-related and what API mode to use.

QUESTION: "${question}"
AIRPORT: ${airport}

STEP 1 - RELEVANCE CHECK:
First, determine if this question is related to aviation/airports/flights/travel. Valid topics include:
- Flight schedules (arrivals/departures)
- Airport information (location, website, facilities, coordinates, timezone)
- Airlines and aircraft
- Travel and aviation topics
- Airport reviews and ratings
- Airport services and amenities

INVALID topics (return relevant: false):
- Weather (unless specifically about airport weather)
- Politics, cooking, sports, entertainment
- General knowledge unrelated to aviation
- Personal questions not about travel
- Technical questions unrelated to airports/flights

STEP 2 - MODE DETERMINATION (only if relevant):
If the question IS aviation-related, determine the FlightAPI mode:
- "arrivals": For flights coming TO this airport (from other places)
- "departures": For flights leaving FROM this airport (to other places)
- "both": For general airport info, ratings, or questions requiring both datasets

Examples:
- "How many flights from Germany?" → "arrivals"
- "Which cities does BA fly to?" → "departures"
- "What is the airport website?" → "both"
- "What are the coordinates?" → "both"
- "What's the airport rating?" → "both"
- "What's the weather like?" → relevant: false

RESPONSE FORMAT:
If NOT aviation-related:
{
  "relevant": false,
  "mode": "none",
  "reasoning": "Question is not related to aviation or airport topics",
  "confidence": "high"
}

If aviation-related:
{
  "relevant": true,
  "mode": "arrivals" or "departures" or "both",
  "reasoning": "Brief explanation of why this mode was chosen",
  "confidence": "high" or "medium" or "low"
}`;

			const response = await this.client.post('/chat/completions', {
				model: 'google/gemini-flash-1.5',
				messages: [
					{
						role: 'user',
						content: analysisPrompt
					}
				],
				max_tokens: 200,
				temperature: 0.1
			});
			
			console.log('LLM Service response status:', response.status);
			console.log('LLM Service response data:', response.data);

			const analysisText = response.data.choices[0]?.message?.content?.trim();
			console.log('Raw LLM analysis response:', analysisText);

			try {
				// Try to extract JSON from response (sometimes LLM adds extra text)
				const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
				const jsonText = jsonMatch ? jsonMatch[0] : analysisText;
				
				const analysis = JSON.parse(jsonText);
				console.log(`✅ Mode analysis: relevant=${analysis.relevant}, mode=${analysis.mode} (${analysis.confidence} confidence) - ${analysis.reasoning}`);
				
				// Check if question is not relevant to aviation
				if (analysis.relevant === false) {
					return {
						relevant: false,
						mode: 'none',
						reasoning: analysis.reasoning,
						confidence: analysis.confidence,
						shouldSkipAPI: true // Flag to skip FlightAPI call
					};
				}
				
				return analysis;
			} catch (parseError) {
				console.warn('⚠️ Could not parse mode analysis:', parseError.message);
				console.warn('Raw response was:', analysisText);
				
				// Fallback: try to determine if question is aviation-related
				const questionLower = question.toLowerCase();
				const aviationKeywords = ['flight', 'airport', 'airline', 'plane', 'aircraft', 'departure', 'arrival', 'terminal', 'gate', 'runway'];
				const isAviationRelated = aviationKeywords.some(keyword => questionLower.includes(keyword));
				
				if (!isAviationRelated) {
					return {
						relevant: false,
						mode: 'none',
						reasoning: 'Question does not contain aviation-related keywords',
						confidence: 'medium',
						shouldSkipAPI: true
					};
				}
				
				// If aviation-related, determine mode
				let fallbackMode = 'both';
				if (questionLower.includes('fly to') || 
				    questionLower.includes('go to') || 
				    questionLower.includes('destination') ||
				    questionLower.includes('departing') ||
				    questionLower.includes('leaving')) {
					fallbackMode = 'departures';
				} else if (questionLower.includes('from') || questionLower.includes('arriving')) {
					fallbackMode = 'arrivals';
				}
				
				return {
					relevant: true,
					mode: fallbackMode,
					reasoning: `Keyword-based fallback analysis (${fallbackMode})`,
					confidence: 'medium'
				};
			}

		} catch (error) {
			console.error('🚨 Mode Analysis Error:', error.message);
			return {
				mode: 'arrivals',
				reasoning: 'Default fallback due to analysis error',
				confidence: 'low'
			};
		}
	}

	/**
	 * Generate an answer to a flight-related question using LLM
	 * @param {string} question - User's question
	 * @param {Object} flightData - Processed flight data from FlightApiService
	 * @param {string} airport - Airport code
	 * @param {string} mode - FlightAPI mode used
	 * @param {Object} modeAnalysis - Mode analysis from LLM
	 * @returns {Promise<string>} Generated answer
	 */
	async generateAnswer(question, flightData, airport, mode, modeAnalysis) {
		try {
			console.log(`🤖 Generating answer for: "${question}" (Airport: ${airport})`);

			const systemPrompt = this._buildSupportSystemPrompt();
			const userPrompt = this._buildSupportUserPrompt(question, flightData, airport, mode, modeAnalysis);

			const response = await this.client.post('/chat/completions', {
				model: 'google/gemini-flash-1.5',
				messages: [
					{
						role: 'system',
						content: systemPrompt
					},
					{
						role: 'user',
						content: userPrompt
					}
				],
				max_tokens: 1500,
				temperature: 0.3,
				top_p: 0.9,
				frequency_penalty: 0.1,
				presence_penalty: 0.1
			});
			console.log('OPENROUTER_API_KEY', OPENROUTER_API_KEY);
			console.log('LLM request response status:', response.status);
			console.log('LLM request response data:', response.data);

			const answer = response.data.choices[0]?.message?.content;
			console.log('generateAnswer response', answer);

			if (!answer) {
				throw new Error('No answer generated by LLM');
			}

			console.log(`✅ Generated answer (${answer.length} characters)`);
			return answer.trim();

		} catch (error) {
			console.error('🚨 LLM Service Error:', error.message);

			if (error.response?.status === 401) {
				throw new Error('Invalid OpenRouter API key. Please check your configuration.');
			} else if (error.response?.status === 429) {
				throw new Error('OpenRouter rate limit exceeded. Please try again later.');
			} else if (error.response?.status === 402) {
				throw new Error('OpenRouter account has insufficient credits.');
			} else if (error.code === 'ECONNABORTED') {
				throw new Error('LLM request timeout. Please try again with a simpler question.');
			} else {
				throw new Error(`Failed to generate answer: ${error.message}`);
			}
		}
	}

	/**
	 * Build support-style system prompt for human-like responses. used in generateAnswer method
	 * @returns {string} System prompt for support manager style
	 */
	_buildSupportSystemPrompt() {
		return `You are a friendly and professional AI support manager for Flight Assistant AI. Your role is to help users understand flight data in a conversational, human-like way.

## Your Personality
- Friendly, helpful, and professional
- Knowledgeable about aviation and travel
- Patient and clear in explanations
- Use natural, conversational language
- Show enthusiasm for helping with flight information

## Response Style
- Start with a friendly acknowledgment of their question
- Provide clear, specific answers based on the flight data
- Use conversational phrases like "I can see that...", "Looking at the data...", "Here's what I found..."
- Include relevant numbers and statistics naturally in conversation
- End with helpful context or additional insights
- Answer should not be ended with a question.

## Data Presentation
- Present numbers in an easy-to-understand way
- Use comparisons and context to make data meaningful
- Highlight interesting patterns or insights
- Mention the time period and data source naturally
- Be specific about what the data shows and any limitations

## Flight data
- if User asks about the flights, you should use the rawFlightData to answer the question and write full data about the flights such as flight number, airline, departure time, arrival time, etc.

## Professional Standards
- Stay accurate to the provided flight data
- Acknowledge when information isn't available
- Use proper airport codes and airline names
- Provide actionable insights when possible
- Maintain a helpful, service-oriented tone

Remember: You're a support manager helping a customer understand flight information. Be human, helpful, and informative.`;
	}


	/**
	 * Build support-style user prompt for human-like responses
	 * @param {string} question - User's question
	 * @param {Object} flightData - Processed flight data
	 * @param {string} airport - Airport code
	 * @param {string} mode - FlightAPI mode used
	 * @param {Object} modeAnalysis - Mode analysis from LLM
	 * @returns {string} Complete user prompt for support style
	 */
	_buildSupportUserPrompt(question, flightData, airport, mode, modeAnalysis) {
		const airportNames = {
			'DXB': 'Dubai International Airport',
			'LHR': 'London Heathrow Airport',
			'CDG': 'Charles de Gaulle Airport (Paris)',
			'SIN': 'Singapore Changi Airport',
			'HKG': 'Hong Kong International Airport',
			'AMS': 'Amsterdam Airport Schiphol'
		};

		const airportName = airportNames[airport] || airport;

		// Build comprehensive prompt with ALL available data
		let prompt = `CUSTOMER SUPPORT REQUEST

Customer Question: "${question}"
Airport: ${airport} (${airportName})
Time Period: ${flightData.dayLabel}

Raw FlightAPI Response: ${JSON.stringify(flightData.rawResult, null, 2)}

COMPLETE FLIGHTAPI DATASET:
You have access to the complete FlightAPI.io response which includes:

AIRPORT DETAILS:`;

		// Add airport details from rawResult
		const airportDetails = flightData.rawResult?.arrivals?.airport || flightData.rawResult?.departures?.airport;
		if (airportDetails?.pluginData?.details) {
			const details = airportDetails.pluginData.details;
			prompt += `
- Name: ${details.name}
- IATA/ICAO: ${details.code?.iata}/${details.code?.icao}
- Location: ${details.position?.region?.city}, ${details.position?.country?.name}
- Coordinates: ${details.position?.latitude}, ${details.position?.longitude}
- Elevation: ${details.position?.elevation}m
- Timezone: ${details.timezone?.name} (${details.timezone?.abbr})
- Official Website: ${details.url?.homepage || 'Not available'}
- Wikipedia: ${details.url?.wikipedia || 'Not available'}`;
		}

		// Add flight diary/reviews if available
		if (airportDetails?.pluginData?.flightdiary) {
			const diary = airportDetails.pluginData.flightdiary;
			prompt += `

AIRPORT REVIEWS & RATINGS:
- Average Rating: ${diary.ratings?.avg}/5 (${diary.ratings?.total} reviews)
- Total Reviews: ${diary.reviews}
- Evaluation Score: ${diary.evaluation}%`;
			
			if (diary.comment && diary.comment.length > 0) {
				prompt += `
- Recent Review: "${diary.comment[0].content.substring(0, 200)}..." - ${diary.comment[0].author.name}`;
			}
		}

		// Add flight schedule summary
		prompt += `

FLIGHT SCHEDULE SUMMARY:
- Total arrivals: ${flightData.summary.totalArrivals}
- Total departures: ${flightData.summary.totalDepartures}
- Countries with arriving flights: ${flightData.summary.arrivalCountries}
- Countries with departing flights: ${flightData.summary.departureCountries}
- Unique airlines: ${flightData.summary.uniqueAirlines}`;

		// Add top countries for both arrivals and departures
		if (flightData.arrivals.total > 0) {
			prompt += `

TOP ARRIVAL COUNTRIES:`;
			const topArrivalCountries = Object.entries(flightData.arrivals.byCountry)
				.sort(([, a], [, b]) => b.length - a.length)
				.slice(0, 8);
			topArrivalCountries.forEach(([country, flights]) => {
				prompt += `\n- ${country}: ${flights.length} flights`;
			});
		}

		if (flightData.departures.total > 0) {
			prompt += `

TOP DEPARTURE COUNTRIES:`;
			const topDepartureCountries = Object.entries(flightData.departures.byCountry)
				.sort(([, a], [, b]) => b.length - a.length)
				.slice(0, 8);
			topDepartureCountries.forEach(([country, flights]) => {
				prompt += `\n- ${country}: ${flights.length} flights`;
			});
		}

		// Add airlines
		if (flightData.arrivals.airlines.length > 0) {
			prompt += `

TOP AIRLINES (Arrivals): ${flightData.arrivals.airlines.slice(0, 8).join(', ')}`;
		}

		if (flightData.departures.airlines.length > 0) {
			prompt += `

TOP AIRLINES (Departures): ${flightData.departures.airlines.slice(0, 8).join(', ')}`;
		}

		prompt += `

INSTRUCTIONS:
Answer the customer's question using ANY relevant information from this complete dataset. The question can be about:
- Flight schedules (arrivals/departures)
- Airport information (location, website, timezone)
- Airlines and routes
- Countries and cities
- Airport facilities and reviews
- Any other data available in the FlightAPI response

Be conversational, helpful, and specific. Use the exact data provided. If the question asks for information not in the dataset, clearly state what information IS available.

CUSTOMER QUESTION: "${question}"

Please provide a friendly, helpful response as an AI support manager.`;

		return prompt;
	}


	/**
	 * Validate question content
	 * @param {string} question - User question to validate
	 * @returns {boolean} Whether question is valid
	 */
	isValidQuestion(question) {
		if (!question || typeof question !== 'string') {
			return false;
		}

		const trimmed = question.trim();

		// Check minimum length
		if (trimmed.length < 5) {
			return false;
		}

		// Check maximum length
		if (trimmed.length > 500) {
			return false;
		}

		// Check for basic question indicators
		const questionWords = ['how', 'what', 'where', 'when', 'why', 'which', 'who', 'many', 'much'];
		const hasQuestionWord = questionWords.some(word =>
			trimmed.toLowerCase().includes(word)
		);

		const hasQuestionMark = trimmed.includes('?');

		return hasQuestionWord || hasQuestionMark;
	}

	/**
	 * Clean and sanitize user question - format question middleware for LLM
	 * @param {string} question - Raw user question
	 * @returns {string} Cleaned question
	 */
	sanitizeQuestion(question) {
		if (!question || typeof question !== 'string') {
			return '';
		}

		return question
			.trim()
			.replace(/\s+/g, ' ') // Replace multiple spaces with single space
			.replace(/[^\w\s\?\!\.\,\-\(\)]/g, '') // Remove special characters except basic punctuation
			.substring(0, 500); // Limit length - можно поднять. режет ответ.
	}
}

export default new LLMService();
