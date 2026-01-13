import { useRef, useEffect, useMemo } from 'react';
import throttle from 'lodash/throttle';

/**
 * A hook that returns a throttled version of the provided callback.
 * 
 * @param {Function} callback - The function to throttle.
 * @param {number} delay - The throttle delay in milliseconds.
 * @returns {Function} - The throttled function.
 */
const useThrottledCalculation = (callback, delay = 50) => {
  const callbackRef = useRef(callback);

  // Update ref so the throttled function always has access to the latest callback
  // without needing to be recreated.
  useEffect(() => {
    callbackRef.current = callback;
  });

  const throttledCallback = useMemo(() => {
    const func = (...args) => {
        return callbackRef.current(...args);
    };
    return throttle(func, delay, { leading: true, trailing: true });
  }, [delay]);

  // Cleanup throttle on unmount to prevent leaks
  useEffect(() => {
    return () => {
      throttledCallback.cancel();
    };
  }, [throttledCallback]);

  return throttledCallback;
};

export default useThrottledCalculation;
