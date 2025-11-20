// Utility to normalize API URL (remove trailing slashes)
const getApiUrl = () => {
    const url = import.meta.env.VITE_API_URL || 'http://localhost:4000';
    return url.replace(/\/+$/, ''); // Remove trailing slashes
};
export const API_URL = getApiUrl();
