import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { auth } from './firebase';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

const IDLE_TIMEOUT_MS = 10 * 60 * 1000;   // 10 minutes until forced logout
const WARN_BEFORE_MS  = 60 * 1000;         // show warning 1 minute before logout

// Events that count as user activity
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser]     = useState(null);
  const [loading, setLoading]             = useState(true);

  // Idle-warning state — consumed by Sidebar (or any subscriber via context)
  const [idleWarning, setIdleWarning]     = useState(false);
  const [secondsLeft, setSecondsLeft]     = useState(60);

  const logoutTimerRef   = useRef(null);
  const warningTimerRef  = useRef(null);
  const countdownRef     = useRef(null);

  // Clear all three timers in one call
  const clearAllTimers = useCallback(() => {
    clearTimeout(logoutTimerRef.current);
    clearTimeout(warningTimerRef.current);
    clearInterval(countdownRef.current);
  }, []);

  // Force sign-out
  const forceLogout = useCallback(async () => {
    clearAllTimers();
    setIdleWarning(false);
    try {
      await auth.signOut();
    } catch (err) {
      console.error('Idle logout error:', err);
    }
  }, [clearAllTimers]);

  // Start (or restart) the idle countdown from zero
  const resetIdleTimer = useCallback(() => {
    if (!auth.currentUser) return;   // no-op when nobody is logged in

    clearAllTimers();
    setIdleWarning(false);
    setSecondsLeft(60);

    // After (IDLE_TIMEOUT_MS - WARN_BEFORE_MS) show the warning banner
    warningTimerRef.current = setTimeout(() => {
      setIdleWarning(true);
      setSecondsLeft(Math.round(WARN_BEFORE_MS / 1000));

      // Tick the countdown every second
      countdownRef.current = setInterval(() => {
        setSecondsLeft(prev => {
          if (prev <= 1) {
            clearInterval(countdownRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }, IDLE_TIMEOUT_MS - WARN_BEFORE_MS);

    // After IDLE_TIMEOUT_MS sign out entirely
    logoutTimerRef.current = setTimeout(forceLogout, IDLE_TIMEOUT_MS);
  }, [clearAllTimers, forceLogout]);

  // Allow Sidebar (or a modal) to dismiss the warning and reset
  const dismissIdleWarning = useCallback(() => {
    resetIdleTimer();
  }, [resetIdleTimer]);

  // Attach / detach activity listeners whenever auth state changes
  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged(user => {
      setCurrentUser(user);
      setLoading(false);

      if (user) {
        // User just logged in — start the idle timer
        resetIdleTimer();

        // Bind activity listeners
        ACTIVITY_EVENTS.forEach(evt =>
          window.addEventListener(evt, resetIdleTimer, { passive: true })
        );
      } else {
        // User logged out — clean up everything
        clearAllTimers();
        setIdleWarning(false);
        ACTIVITY_EVENTS.forEach(evt =>
          window.removeEventListener(evt, resetIdleTimer)
        );
      }
    });

    return () => {
      unsubscribeAuth();
      clearAllTimers();
      ACTIVITY_EVENTS.forEach(evt =>
        window.removeEventListener(evt, resetIdleTimer)
      );
    };
  }, [resetIdleTimer, clearAllTimers]);

  const value = {
    currentUser,
    idleWarning,
    secondsLeft,
    dismissIdleWarning,
    login:    (email, password) => auth.signInWithEmailAndPassword(email, password),
    register: (email, password) => auth.createUserWithEmailAndPassword(email, password),
    logout:   () => auth.signOut()
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}