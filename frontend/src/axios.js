import axios from "axios";
import { useToast } from "vue-toast-notification";
import { getKT } from "./store";
import router from "./router";

// Set the base URL for all axios requests
const baseURL = process.env.VUE_APP_API_HOST || '';
console.log('Axios base URL:', baseURL || '(same origin)');
axios.defaults.baseURL = baseURL;

function reject(error) {
    console.log('Axios error:', error);

    // Handle 2FA requirement
    if (error.response?.data?.message === '2FA Is required') {
        console.log('2FA required');
        router.push({ name: 'TwoFa' });
        return;
    }

    // Handle unauthorized access (skip for token refresh endpoint)
    if (error.response?.status === 401) {
        const requestUrl = error.config?.url || '';
        if (requestUrl.includes('/auth/refresh')) {
            // Let the store's refreshAuth catch handler deal with it
            throw error;
        }
        console.log('401 Unauthorized - redirecting to login');
        localStorage.removeItem('t'); // Clear invalid token
        router.push({ name: 'Login' });
        return;
    }

    const toast = useToast();
    const errorMessage = error.response?.data?.message || error.message || 'An error occurred';

    if (!errorMessage) {
        throw error;
    }

    const errors = Array.isArray(errorMessage) ? errorMessage : [errorMessage];
    toast.error(`Error:<br> ${errors.join('<br>')}`);
    throw new Error(errors)
}

axios.interceptors.response.use(
    (value) => value,
    reject
)

axios.interceptors.request.use((config) => {
    const token = getKT();
    if (token) {
        config.headers.Authorization = 'Bearer ' + token;
    }
    console.log('Request config:', config.url, config.baseURL);
    return config;
})

export default axios;
