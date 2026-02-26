// API Configuration
const API_BASE_URL = 'https://invisible-connections-production.up.railway.app';
const SOCKET_URL = 'https://invisible-connections-production.up.railway.app';

// API endpoints
const API_ENDPOINTS = {
  // Auth
  register: `${API_BASE_URL}/auth/register`,
  login: `${API_BASE_URL}/auth/login`,
  verify: `${API_BASE_URL}/auth/verify`,
  
  // Users
  profile: `${API_BASE_URL}/users/profile`,
  interests: `${API_BASE_URL}/users/interests`,
  traits: `${API_BASE_URL}/users/traits`,
  userByUsername: (username) => `${API_BASE_URL}/users/${username}`,
  
  // Matches
  findMatches: `${API_BASE_URL}/matches/find`,
  createMatch: `${API_BASE_URL}/matches/create`,
  myMatches: `${API_BASE_URL}/matches/my-matches`,
  deleteMatch: (matchId) => `${API_BASE_URL}/matches/${matchId}`,
  
  // Inbox
  inbox: `${API_BASE_URL}/inbox`,
  conversation: (conversationId) => `${API_BASE_URL}/inbox/${conversationId}`,
  conversationMessages: (conversationId) => `${API_BASE_URL}/inbox/${conversationId}/messages`,
  conversationInfo: (conversationId) => `${API_BASE_URL}/inbox/${conversationId}/info`,
  searchUsers: `${API_BASE_URL}/inbox/search-users`,
};

// Helper function to get auth headers
function getAuthHeaders() {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : ''
  };
}

// Helper function to make authenticated API calls
async function apiCall(url, options = {}) {
  const defaultOptions = {
    headers: getAuthHeaders(),
    ...options
  };

  try {
    const response = await fetch(url, defaultOptions);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'API call failed');
    }

    return data;
  } catch (error) {
    console.error('API Error:', error);
    
    // If unauthorized, redirect to login
    if (error.message.includes('token') || error.message.includes('401')) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/landing.html';
    }
    
    throw error;
  }
}

// Check if user is authenticated
async function checkAuth() {
  const token = localStorage.getItem('token');
  
  if (!token) {
    return false;
  }

  try {
    const result = await apiCall(API_ENDPOINTS.verify);
    if (result.valid) {
      localStorage.setItem('user', JSON.stringify(result.user));
      return true;
    }
    return false;
  } catch (error) {
    return false;
  }
}

// Logout function
function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/landing.html';
}
