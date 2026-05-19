import axios from 'axios';

const api = axios.create({
  baseURL: 'https://izozo.izozo.co.za/api', // Django backend API
  headers: {
    'Content-Type': 'application/json',
  },
});

export default api;
