import { useState, useCallback, useMemo, useEffect, useRef } from 'react';

interface RateLimitState {
  recentSends: Date[];
  blocked: boolean;
  blockedUntil: Date | null;
}

interface UseChatRateLimitReturn {
  canSend: boolean;
  messagesThisMinute: number;
  messagesThisHour: number;
  isBlocked: boolean;
  blockedSeconds: number;
  recordSend: () => void;
  handleRateLimitError: (retryAfterSeconds?: number) => void;
}

const MAX_PER_MINUTE = 5;
const MAX_PER_HOUR = 30;

export function useChatRateLimit(): UseChatRateLimitReturn {
  const [state, setState] = useState<RateLimitState>({
    recentSends: [],
    blocked: false,
    blockedUntil: null,
  });
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Clean up old entries periodically
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      const now = Date.now();
      setState(prev => ({
        ...prev,
        recentSends: prev.recentSends.filter(d => now - d.getTime() < 60 * 60 * 1000),
        blocked: prev.blockedUntil ? now < prev.blockedUntil.getTime() : false,
        blockedUntil: prev.blockedUntil && now >= prev.blockedUntil.getTime() ? null : prev.blockedUntil,
      }));
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const messagesThisMinute = useMemo(() => {
    const oneMinuteAgo = Date.now() - 60 * 1000;
    return state.recentSends.filter(d => d.getTime() > oneMinuteAgo).length;
  }, [state.recentSends]);

  const messagesThisHour = useMemo(() => {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    return state.recentSends.filter(d => d.getTime() > oneHourAgo).length;
  }, [state.recentSends]);

  const canSend = useMemo(() => {
    if (state.blocked) return false;
    if (messagesThisMinute >= MAX_PER_MINUTE) return false;
    if (messagesThisHour >= MAX_PER_HOUR) return false;
    return true;
  }, [state.blocked, messagesThisMinute, messagesThisHour]);

  const blockedSeconds = useMemo(() => {
    if (!state.blockedUntil) return 0;
    const remaining = state.blockedUntil.getTime() - Date.now();
    return Math.max(0, Math.ceil(remaining / 1000));
  }, [state.blockedUntil]);

  const recordSend = useCallback(() => {
    setState(prev => ({
      ...prev,
      recentSends: [...prev.recentSends, new Date()],
    }));
  }, []);

  const handleRateLimitError = useCallback((retryAfterSeconds: number = 60) => {
    setState(prev => ({
      ...prev,
      blocked: true,
      blockedUntil: new Date(Date.now() + retryAfterSeconds * 1000),
    }));
  }, []);

  return {
    canSend,
    messagesThisMinute,
    messagesThisHour,
    isBlocked: state.blocked,
    blockedSeconds,
    recordSend,
    handleRateLimitError,
  };
}
