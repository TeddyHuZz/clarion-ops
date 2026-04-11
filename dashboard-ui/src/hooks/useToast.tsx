import { useCallback } from 'react';
import { toast } from 'sonner';

export type ToastType = 'success' | 'error';

/**
 * Drop-in replacement for the legacy useToast hook.
 * Now powered by sonner. Returns the same { showToast, ToastContainer } shape.
 */
export function useToast() {
  const showToast = useCallback((type: ToastType, message: string) => {
    if (type === 'success') {
      toast.success(message);
    } else {
      toast.error(message);
    }
  }, []);

  // No-op container — sonner's <Toaster> is rendered in App.tsx
  const ToastContainer = () => null;

  return { showToast, ToastContainer };
}

