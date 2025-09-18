import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE || '/api';

class ApiService {
  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 60000,
      headers: {
        'Content-Type': 'application/json',
      }
    });

    // logging interceptor
    this.client.interceptors.request.use(
      (config) => {
        console.log(`🌐 API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        console.error('🚨 API Request Error:', error);
        return Promise.reject(error);
      }
    );

    // interceptor for error handling
    this.client.interceptors.response.use(
      (response) => {
        console.log(`✅ API Response: ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        console.error('🚨 API Response Error:', {
          status: error.response?.status,
          message: error.response?.data?.error || error.message,
          url: error.config?.url
        });

        // Transform error for better user experience
        const transformedError = this.transformError(error);
        return Promise.reject(transformedError);
      }
    );
  }

  /**
   * Transform API errors into user-friendly messages
   * @param {Error} error - Original error
   * @returns {Error} Transformed error
   */
  transformError(error) {
    if (!error.response) {
      // Network error
      return new Error('Network error. Please check your internet connection.');
    }

    const { status, data } = error.response;
    
    switch (status) {
      case 400:
        return new Error(data.error || 'Invalid request. Please check your input.');
      case 401:
        return new Error('Authentication failed. Please check API credentials.');
      case 404:
        return new Error(data.error || 'Requested data not found.');
      case 429:
        return new Error('Rate limit exceeded. Please try again later.');
      case 500:
        return new Error(data.error || 'Server error. Please try again later.');
      case 502:
        return new Error('External service unavailable. Please try again later.');
      case 504:
        return new Error('Request timeout. Please try again.');
      default:
        return new Error(data.error || `Unexpected error (${status}). Please try again.`);
    }
  }

  /**
   * Query flight data with a natural language question
   * @param {string} airport - Airport IATA code
   * @param {string} question - User's question
   * @param {string} date - Optional date in YYYY-MM-DD format
   * @returns {Promise<Object>} Query response
   */
  async queryFlights(airport, question, date = null) {
    try {
      const response = await this.client.post('/flights/query', {
        airport: airport.toUpperCase(),
        question: question.trim(),
        date
      });

      return response.data;
    } catch (error) {
      throw error; // Re-throw transformed error
    }
  }

}

export default new ApiService();
