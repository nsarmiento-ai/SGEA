import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date) {
  return new Date(date).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function optimizeCloudinaryUrl(url: string | undefined | null) {
  if (!url || !url.includes('res.cloudinary.com')) return url || '';
  
  // If it already has transformations, replace them with optimized ones
  if (url.includes('/upload/')) {
    const parts = url.split('/upload/');
    // Standardize transformations: auto format, eco quality, limit width to 300px
    return `${parts[0]}/upload/f_auto,q_auto:eco,w_300,c_limit/${parts[1]}`;
  }
  
  return url;
}
