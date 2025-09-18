import express from 'express';
import flightApiService from '../services/flightApi.js';
import llmService from '../services/llmService.js';

const router = express.Router();

// Validation middleware
const validateQueryRequest = (req, res, next) => {
	const { airport, question, date } = req.body;

	// Validate airport
	if (!airport || typeof airport !== 'string') {
		return res.status(400).json({
			error: 'Airport code is required and must be a string',
			code: 'INVALID_AIRPORT'
		});
	}

	if (!flightApiService.isValidAirportCode(airport)) {
		return res.status(400).json({
			error: 'Invalid airport code. Supported airports: DXB, LHR, CDG, SIN, HKG, AMS', // туду под TS если будем компилировать можно енам справочник завести
			code: 'UNSUPPORTED_AIRPORT',
			supportedAirports: ['DXB', 'LHR', 'CDG', 'SIN', 'HKG', 'AMS']
		});
	}

	// Validate question
	if (!question || typeof question !== 'string') {
		return res.status(400).json({
			error: 'Question is required and must be a string',
			code: 'INVALID_QUESTION'
		});
	}

	if (!llmService.isValidQuestion(question)) {
		return res.status(400).json({
			error: 'Please provide a valid question (minimum 5 characters, should be flight-related)',
			code: 'INVALID_QUESTION_FORMAT'
		});
	}

	// Validate date if provided - now expecting day parameter (-1, 1, 2)
	if (date !== null && date !== undefined && ![-1, 1, 2].includes(Number(date))) {
		return res.status(400).json({
			error: 'Date parameter must be -1 (yesterday), 1 (today), or 2 (tomorrow)',
			code: 'INVALID_DAY_PARAMETER'
		});
	}

	// Sanitize inputs
	req.body.airport = airport.toUpperCase().trim();
	req.body.question = llmService.sanitizeQuestion(question);
	req.body.date = Number(date) || null;

	next();
};

/**
 * POST /api/flights/query
 * Main endpoint for querying flight data with natural language questions
 */
router.post('/query', validateQueryRequest, async (req, res) => {
	const startTime = Date.now();
	const { airport, question, date } = req.body;

	try {
		console.log('req.body', req.body);
		console.log(`🎯 Processing query for ${airport}: "${question}"`);

		// Step 1: Analyze question to determine FlightAPI mode and relevance
		console.log('🔍 Analyzing question for relevance and optimal FlightAPI mode...');
		const modeAnalysis = await llmService.analyzeQuestionForMode(question, airport);
		
		// Step 2: Check if question is relevant to aviation/airports -> return to frontend
		if (modeAnalysis.shouldSkipAPI || modeAnalysis.relevant === false) {
			console.log('⚠️ Question not relevant to aviation, skipping FlightAPI call');
			const responseTime = Date.now() - startTime;
			
			return res.json({
				success: true,
				airport,
				airportName: flightApiService.getAirportName(airport),
				question,
				answer: "Sorry, I can't understand your question. Can you ask again? I'm designed to help with flight schedules, airport information, airlines, and other aviation-related topics.",
				analysis: {
					mode: modeAnalysis.mode,
					reasoning: modeAnalysis.reasoning,
					confidence: modeAnalysis.confidence,
					relevant: false
				},
				metadata: {
					responseTime: `${responseTime}ms`,
					timestamp: new Date().toISOString(),
					dataSource: 'No API call made',
					aiModel: 'Gemini Flash 1.5',
					flightApiCalled: false
				}
			});
		}
		
		// Step 3: Fetch flight data using intelligent mode selection
		console.log(`📡 Fetching flight data (mode: ${modeAnalysis.mode})...`);
		const dayParam = date || 1; // Default to today (1) if no date provided
		const rawFlightData = await flightApiService.getAirportSchedule(airport, dayParam, modeAnalysis.mode);
		console.log('rawFlightData', JSON.stringify(rawFlightData, null, 2));

		if (rawFlightData.arrivals.length === 0 && rawFlightData.departures.length === 0) {
			return res.status(404).json({
				error: `No flight data available for ${airport} (${rawFlightData.dayLabel})`,
				code: 'NO_FLIGHT_DATA',
				airport,
				dayParam: rawFlightData.dayParam,
				dayLabel: rawFlightData.dayLabel
			});
		}

		// Step 3: Process flight data
		console.log('🔄 Processing flight data...');
		const processedData = flightApiService.processFlightData(rawFlightData);
		console.log('processedData', JSON.stringify(processedData, null, 2));

		// Step 5: Generate human-like AI answer as support manager
		console.log('🤖 Generating support-style answer...');
		const answer = await llmService.generateAnswer(question, processedData, airport, modeAnalysis.mode, modeAnalysis);

		const responseTime = Date.now() - startTime;
		console.log(`✅ Query completed in ${responseTime}ms`);

		// Step 5: Return comprehensive response with mode analysis
		// (all data for frontend summary cards. rawResult is Used by LLM to generate answer with dataset)
		res.json({
			success: true,
			airport,
			airportName: flightApiService.getAirportName(airport),
			question,
			answer,
			analysis: {
				mode: modeAnalysis.mode,
				reasoning: modeAnalysis.reasoning,
				confidence: modeAnalysis.confidence
			},
			data: {
				dayParam: processedData.dayParam,
				dayLabel: processedData.dayLabel,
				summary: processedData.summary,
				// Include processed data for frontend display
				arrivals: {
					total: processedData.arrivals.total,
					topCountries: Object.entries(processedData.arrivals.byCountry)
						.sort(([, a], [, b]) => b.length - a.length)
						.slice(0, 10)
						.map(([country, flights]) => ({ country, count: flights.length })),
					topAirlines: processedData.arrivals.airlines.slice(0, 10)
				},
				departures: {
					total: processedData.departures.total,
					topCountries: Object.entries(processedData.departures.byCountry)
						.sort(([, a], [, b]) => b.length - a.length)
						.slice(0, 10)
						.map(([country, flights]) => ({ country, count: flights.length })),
					topAirlines: processedData.departures.airlines.slice(0, 10)
				},
				// Include complete raw FlightAPI response for debugging and advanced questions
				rawResult: processedData.rawResult
			},
			metadata: {
				responseTime: `${responseTime}ms`,
				timestamp: new Date().toISOString(),
				dataSource: 'FlightAPI.io',
				aiModel: 'Gemini Flash 1.5',
				flightApiMode: modeAnalysis.mode,
				flightApiCalled: true
			}
		});

	} catch (error) {
		const responseTime = Date.now() - startTime;
		console.error(`🚨 Query failed after ${responseTime}ms:`, error.message);

		// Determine error type and appropriate response
		// на енам справочники посадить можно
		let statusCode = 500;
		let errorCode = 'INTERNAL_ERROR';

		if (error.message.includes('Invalid FlightAPI key')) {
			statusCode = 502;
			errorCode = 'FLIGHT_API_ERROR';
		} else if (error.message.includes('rate limit')) {
			statusCode = 429;
			errorCode = 'RATE_LIMIT_EXCEEDED';
		} else if (error.message.includes('timeout')) {
			statusCode = 504;
			errorCode = 'REQUEST_TIMEOUT';
		} else if (error.message.includes('Invalid OpenRouter')) {
			statusCode = 502;
			errorCode = 'LLM_API_ERROR';
		}

		res.status(statusCode).json({
			error: error.message,
			code: errorCode,
			airport,
			question,
			metadata: {
				responseTime: `${responseTime}ms`,
				timestamp: new Date().toISOString()
			}
		});
	}
});

/**
 * GET /api/flights/airports
 * Get list of supported airports - TODO integrate with frontend
 */
router.get('/airports', (req, res) => {
	const airports = [
		{ code: 'DXB', name: 'Dubai International Airport', city: 'Dubai', country: 'UAE' },
		{ code: 'LHR', name: 'London Heathrow Airport', city: 'London', country: 'UK' },
		{ code: 'CDG', name: 'Charles de Gaulle Airport', city: 'Paris', country: 'France' },
		{ code: 'SIN', name: 'Singapore Changi Airport', city: 'Singapore', country: 'Singapore' },
		{ code: 'HKG', name: 'Hong Kong International Airport', city: 'Hong Kong', country: 'Hong Kong' },
		{ code: 'AMS', name: 'Amsterdam Airport Schiphol', city: 'Amsterdam', country: 'Netherlands' }
	];

	res.json({
		airports,
		total: airports.length,
		metadata: {
			timestamp: new Date().toISOString()
		}
	});
});

/**
 * GET /api/flights/health
 * Health check endpoint mock for the flights service. можно на пм2 посадить трекать жив ли сервис
 */
router.get('/health', async (req, res) => {
	const health = {
		status: 'OK',
		timestamp: new Date().toISOString(),
		services: {
			flightApi: 'Unknown',
			llm: 'Unknown'
		}
	};

	// Don't test FlightAPI in health check to avoid unnecessary expensive API calls
	health.services.flightApi = 'Not tested (avoiding unnecessary API calls)';

	// Note: We don't test LLM service in health check to avoid unnecessary API calls
	health.services.llm = 'Not tested';

	const statusCode = health.status === 'OK' ? 200 : 503;
	res.status(statusCode).json(health);
});

export default router;
