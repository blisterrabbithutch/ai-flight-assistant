import axios from 'axios';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const FLIGHT_API_KEY = process.env.FLIGHT_API_KEY;
const FLIGHT_API_BASE = process.env.FLIGHT_API_BASE_URL;

class FlightApiService {
  constructor() {
    this.client = axios.create({
      baseURL: FLIGHT_API_BASE,
      timeout: 30000,
      headers: {
        'User-Agent': 'FlightAssistantAI/1.0'
      }
    });

    // Request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        console.log(`🛫 FlightAPI Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        console.error('🚨 FlightAPI Request Error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor for logging and error handling
    this.client.interceptors.response.use(
      (response) => {
        console.log(`✅ FlightAPI Response: ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        console.error('🚨 FlightAPI Response Error:', {
          status: error.response?.status,
          message: error.response?.data?.message || error.message,
          url: error.config?.url
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * Get airport schedule using /schedule endpoint - simplified version
   * @param {string} airportCode - IATA airport code (e.g., 'LHR', 'DXB')
   * @param {number|string} dayParam - Day parameter: -1 (yesterday), 1 (today), 2 (tomorrow)
   * @param {string} mode - FlightAPI mode: 'arrivals', 'departures', or 'both' (default)
   * @returns {Promise<Object>} Flight schedule data with rawResult
   */
  async getAirportSchedule(airportCode, dayParam = 1, mode = 'both') {
    try {
      const validDayParam = Number(dayParam) || 1;
      console.log(`📡 Fetching flight data for ${airportCode} (day: ${validDayParam}, mode: ${mode})`);

      let rawResult = {};

      // Make API calls based on mode
      if (mode === 'both' || mode === 'arrivals') {
        const arrivalsResponse = await this.client.get(`/schedule/${FLIGHT_API_KEY}`, {
          params: {
            mode: 'arrivals',
            iata: airportCode.toUpperCase(),
            day: validDayParam
          }
        });
        rawResult.arrivals = arrivalsResponse.data;
      }

      if (mode === 'both' || mode === 'departures') {
        const departuresResponse = await this.client.get(`/schedule/${FLIGHT_API_KEY}`, {
          params: {
            mode: 'departures',
            iata: airportCode.toUpperCase(),
            day: validDayParam
          }
        });
        rawResult.departures = departuresResponse.data;
      }

      // Extract flight arrays for processing
      const arrivals = rawResult.arrivals?.airport?.pluginData?.schedule?.arrivals?.data || [];
      const departures = rawResult.departures?.airport?.pluginData?.schedule?.departures?.data || [];

      const result = {
        airport: airportCode.toUpperCase(),
        dayParam: validDayParam,
        dayLabel: this.getDayLabel(validDayParam),
        arrivals: arrivals,
        departures: departures,
        rawResult: rawResult, // This is the complete FlightAPI response
        metadata: {
          totalArrivals: arrivals.length,
          totalDepartures: departures.length,
          fetchedAt: new Date().toISOString(),
          apiEndpoint: 'FlightAPI.io /schedule',
          parameters: {
            mode: mode,
            iata: airportCode.toUpperCase(),
            day: validDayParam
          }
        }
      };

      console.log(`📊 Retrieved ${arrivals.length} arrivals and ${departures.length} departures for ${airportCode} (${this.getDayLabel(validDayParam)})`);
      
      return result;

    } catch (error) {
      console.error('🚨 FlightAPI Service Error:', error.message);
      
      if (error.response?.status === 401) {
        throw new Error('Invalid FlightAPI key. Please check your API configuration.');
      } else if (error.response?.status === 429) {
        throw new Error('FlightAPI rate limit exceeded. Please try again later.');
      } else if (error.response?.status === 404) {
        throw new Error(`Airport ${airportCode} not found or no data available.`);
      } else if (error.code === 'ECONNABORTED') {
        throw new Error('FlightAPI request timeout. Please try again.');
      } else {
        throw new Error(`Failed to fetch flight data: ${error.message}`);
      }
    }
  }

  /**
   * Get day label for day parameter
   * @param {number} dayParam - Day parameter
   * @returns {string} Human readable day label
   */
  getDayLabel(dayParam) {
    switch (Number(dayParam)) {
      case -1: return 'Yesterday'
      case 1: return 'Today'
      case 2: return 'Tomorrow'
      default: return 'Today'
    }
  }

  /**
   * Process and analyze flight data for LLM consumption
   * @param {Object} flightData - Raw flight data from getAirportSchedule
   * @returns {Object} Processed and structured flight data
   */
  processFlightData(flightData) {
    const { arrivals, departures, airport, dayParam, dayLabel, rawResult } = flightData;

    // Process arrivals by country and city
    const arrivalsByCountry = new Map();
    const arrivalsByCity = new Map();
    const arrivalAirlines = new Set();

    arrivals.forEach(flight => {
      if (flight.flight) {
        // Extract country and city information from FlightAPI /schedule response
        const originAirport = flight.flight.airport?.origin;
        const country = originAirport?.position?.country?.name || 
                       originAirport?.position?.country?.code || 
                       'Unknown Country';
        
        const city = originAirport?.name || 
                    originAirport?.code?.iata || 
                    'Unknown City';
        
        const airline = flight.flight.airline?.name || 
                       flight.flight.airline?.code?.iata || 
                       'Unknown Airline';

        // Group by country
        if (!arrivalsByCountry.has(country)) {
          arrivalsByCountry.set(country, []);
        }
        arrivalsByCountry.get(country).push({
          city,
          airline,
          flightNumber: flight.flight.identification?.number?.default || flight.flight.identification?.callsign,
          scheduledTime: flight.flight.time?.scheduled?.departure,
          actualTime: flight.flight.time?.real?.departure,
          status: flight.flight.status?.text,
          aircraft: flight.flight.aircraft?.model?.text || flight.flight.aircraft?.registration
        });

        // Group by city
        if (!arrivalsByCity.has(city)) {
          arrivalsByCity.set(city, []);
        }
        arrivalsByCity.get(city).push({
          country,
          airline,
          flightNumber: flight.flight.identification?.number?.default || flight.flight.identification?.callsign,
          scheduledTime: flight.flight.time?.scheduled?.departure,
          status: flight.flight.status?.text
        });

        arrivalAirlines.add(airline);
      }
    });

    // Process departures by country and city
    const departuresByCountry = new Map();
    const departuresByCity = new Map();
    const departureAirlines = new Set();

    departures.forEach(flight => {
      if (flight.flight) {
        // Extract destination country and city information from FlightAPI /schedule response
        const destinationAirport = flight.flight.airport?.destination;
        const country = destinationAirport?.position?.country?.name || 
                       destinationAirport?.position?.country?.code || 
                       'Unknown Country';
        
        const city = destinationAirport?.name || 
                    destinationAirport?.code?.iata || 
                    'Unknown City';
        
        const airline = flight.flight.airline?.name || 
                       flight.flight.airline?.code?.iata || 
                       'Unknown Airline';

        // Group by country
        if (!departuresByCountry.has(country)) {
          departuresByCountry.set(country, []);
        }
        departuresByCountry.get(country).push({
          city,
          airline,
          flightNumber: flight.flight.identification?.number?.default || flight.flight.identification?.callsign,
          scheduledTime: flight.flight.time?.scheduled?.arrival,
          actualTime: flight.flight.time?.real?.arrival,
          status: flight.flight.status?.text,
          aircraft: flight.flight.aircraft?.model?.text || flight.flight.aircraft?.registration
        });

        // Group by city
        if (!departuresByCity.has(city)) {
          departuresByCity.set(city, []);
        }
        departuresByCity.get(city).push({
          country,
          airline,
          flightNumber: flight.flight.identification?.number?.default || flight.flight.identification?.callsign,
          scheduledTime: flight.flight.time?.scheduled?.arrival,
          status: flight.flight.status?.text
        });

        departureAirlines.add(airline);
      }
    });

    return {
      airport,
      dayParam,
      dayLabel,
      summary: {
        totalArrivals: arrivals.length,
        totalDepartures: departures.length,
        arrivalCountries: arrivalsByCountry.size,
        departureCountries: departuresByCountry.size,
        arrivalCities: arrivalsByCity.size,
        departureCities: departuresByCity.size,
        uniqueAirlines: new Set([...arrivalAirlines, ...departureAirlines]).size
      },
      arrivals: {
        byCountry: Object.fromEntries(arrivalsByCountry),
        byCity: Object.fromEntries(arrivalsByCity),
        airlines: Array.from(arrivalAirlines),
        total: arrivals.length
      },
      departures: {
        byCountry: Object.fromEntries(departuresByCountry),
        byCity: Object.fromEntries(departuresByCity),
        airlines: Array.from(departureAirlines),
        total: departures.length
      },
      metadata: flightData.metadata,
      rawResult: rawResult
    };
  }


  /**
   * Validate airport code
   * @param {string} airportCode - IATA airport code to validate
   * @returns {boolean} Whether the airport code is valid
   */
  isValidAirportCode(airportCode) {
    const validAirports = ['DXB', 'LHR', 'CDG', 'SIN', 'HKG', 'AMS'];
    return validAirports.includes(airportCode?.toUpperCase());
  }

  /**
   * Get airport name by code
   * @param {string} airportCode - IATA airport code
   * @returns {string} Full airport name
   */
  getAirportName(airportCode) {
    const airportNames = {
      'DXB': 'Dubai International Airport',
      'LHR': 'London Heathrow Airport', 
      'CDG': 'Charles de Gaulle Airport (Paris)',
      'SIN': 'Singapore Changi Airport',
      'HKG': 'Hong Kong International Airport',
      'AMS': 'Amsterdam Airport Schiphol'
    };
    
    return airportNames[airportCode?.toUpperCase()] || 'Unknown Airport';
  }
}

export default new FlightApiService();
