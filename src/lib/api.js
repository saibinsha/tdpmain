import axios from 'axios';
import { api } from './api.ts';

const API = axios.create({
  baseURL: import.meta.env.VITE_API_BASE,
  withCredentials: true,
});

export default API;

export { api };
