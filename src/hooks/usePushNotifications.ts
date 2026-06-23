import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications() {
  const [isSubscribed, setIsSubscribed] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Check initial subscription state on mount
  useEffect(() => {
    let active = true;

    async function checkSubscription() {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        return;
      }

      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (active) {
          setIsSubscribed(!!subscription);
        }
      } catch (err) {
        console.error('Error checking active push subscription state:', err);
      }
    }

    checkSubscription();
    return () => {
      active = false;
    };
  }, []);

  const subscribeToPush = useCallback(async (): Promise<boolean> => {
    setError(null);

    // 1. Verify support
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      const msg = 'Push notifications are not supported by this browser';
      setError(msg);
      console.warn(msg);
      return false;
    }

    try {
      // Get current authenticated user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('User must be authenticated to subscribe to push notifications');
      }

      // 2. Request permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.log('Push notification permission denied/dismissed');
        return false;
      }

      setIsLoading(true);

      // 3. Get ready service worker
      const registration = await navigator.serviceWorker.ready;

      // 4. Get VAPID public key
      const vapidPublicKey = (import.meta as any).env.VITE_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        throw new Error('VITE_VAPID_PUBLIC_KEY is not defined in the environment variables');
      }

      const convertedKey = urlBase64ToUint8Array(vapidPublicKey);

      // 5. Subscribe
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey,
      });

      const subJson = subscription.toJSON();
      const endpoint = subJson.endpoint;
      const p256dh = subJson.keys?.p256dh;
      const authKey = subJson.keys?.auth;

      if (!endpoint || !p256dh || !authKey) {
        throw new Error('Invalid web push subscription structure returned from browser');
      }

      // 6. Save in Supabase
      const { error: insertError } = await supabase
        .from('push_subscriptions')
        .upsert(
          {
            user_id: user.id,
            endpoint,
            p256dh_key: p256dh,
            auth_key: authKey,
          },
          { onConflict: 'endpoint' }
        );

      if (insertError) {
        throw insertError;
      }

      setIsSubscribed(true);
      return true;
    } catch (err: any) {
      const errMsg = err?.message || 'Failed to subscribe to push notifications';
      setError(errMsg);
      console.error('Error subscribing to push notifications:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    subscribeToPush,
    isSubscribed,
    isLoading,
    error,
  };
}
