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

export function optimizeCloudinaryUrl(url: string | undefined | null, highPriority: boolean = false) {
  if (!url || !url.includes('res.cloudinary.com')) return url || '';
  
  if (url.includes('/upload/')) {
    const parts = url.split('/upload/');
    // Standardize transformations
    const quality = highPriority ? 'best' : 'eco';
    const width = highPriority ? '600' : '300';
    return `${parts[0]}/upload/f_auto,q_auto:${quality},w_${width},c_limit/${parts[1]}`;
  }
  
  return url;
}
