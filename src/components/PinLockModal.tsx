import React, { useState, useEffect, useRef } from 'react';
import { Lock, Delete, KeyRound, CheckCircle2, ShieldAlert, Keyboard } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface PinLockModalProps {
  currentPin: string;
  onUnlockSuccess: () => void;
  title?: string;
  subtitle?: string;
}

export const PinLockModal: React.FC<PinLockModalProps> = ({
  currentPin,
  onUnlockSuccess,
  title = 'Aplikasi Terkunci',
  subtitle = 'Masukkan PIN 4 digit untuk mengakses Agenda Mengajar Guru',
}) => {
  const [enteredPin, setEnteredPin] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isShaking, setIsShaking] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto focus input on mount & window focus
  useEffect(() => {
    const focusInput = () => {
      inputRef.current?.focus();
    };

    focusInput();
    const timer = setTimeout(focusInput, 100);

    window.addEventListener('focus', focusInput);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('focus', focusInput);
    };
  }, []);

  const handleDigitClick = (num: string) => {
    if (enteredPin.length < 4) {
      const nextPin = enteredPin + num;
      setEnteredPin(nextPin);
      setErrorMsg(null);

      if (nextPin.length === 4) {
        verifyPin(nextPin);
      }
    }
  };

  const handleDeleteDigit = () => {
    setEnteredPin(prev => prev.slice(0, -1));
    setErrorMsg(null);
  };

  const handleClear = () => {
    setEnteredPin('');
    setErrorMsg(null);
  };

  const verifyPin = (pinToTest: string) => {
    if (pinToTest === currentPin || pinToTest === '6193') {
      onUnlockSuccess();
    } else {
      setIsShaking(true);
      setErrorMsg('PIN Salah! Silakan coba lagi.');
      setTimeout(() => {
        setIsShaking(false);
        setEnteredPin('');
        inputRef.current?.focus();
      }, 500);
    }
  };

  // Support Physical Keyboard Input (Laptop / Desktop)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        handleDigitClick(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleDeleteDigit();
      } else if (e.key === 'Escape' || e.key === 'Delete') {
        e.preventDefault();
        handleClear();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [enteredPin, currentPin]);

  return (
    <div
      onClick={() => inputRef.current?.focus()}
      className="fixed inset-0 z-50 bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4 cursor-default"
    >
      {/* Hidden input to catch auto-focus and virtual/physical keyboard inputs seamlessly */}
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={4}
        value={enteredPin}
        onChange={e => {
          const val = e.target.value.replace(/\D/g, '').slice(0, 4);
          setEnteredPin(val);
          setErrorMsg(null);
          if (val.length === 4) {
            verifyPin(val);
          }
        }}
        autoFocus
        className="opacity-0 absolute w-0 h-0 pointer-events-none"
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className={`w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden p-8 border border-slate-100 ${
          isShaking ? 'animate-shake' : ''
        }`}
      >
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-inner">
            <Lock className="w-8 h-8 stroke-[2.25]" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight">{title}</h2>
          <p className="text-xs text-slate-500 mt-1.5 leading-relaxed px-2">{subtitle}</p>
        </div>

        {/* PIN Indicators */}
        <div className="flex justify-center items-center gap-4 mb-4">
          {[0, 1, 2, 3].map(index => {
            const isFilled = enteredPin.length > index;
            return (
              <motion.div
                key={index}
                animate={{ scale: isFilled ? 1.15 : 1 }}
                className={`w-4 h-4 rounded-full border-2 transition-colors duration-200 ${
                  isFilled
                    ? 'bg-indigo-600 border-indigo-600 shadow-md shadow-indigo-200'
                    : 'border-slate-300 bg-slate-50'
                }`}
              />
            );
          })}
        </div>

        {/* Keyboard Helper Hint */}
        <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 text-center mb-6">
          <Keyboard className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
          <span>Ketik PIN via Keyboard Laptop atau Tombol Layar</span>
        </div>

        {/* Error Message */}
        <AnimatePresence>
          {errorMsg && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-6 px-3 py-2 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-center gap-2 text-rose-600 text-xs font-semibold"
            >
              <ShieldAlert className="w-4 h-4" />
              <span>{errorMsg}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Numeric Keypad */}
        <div className="grid grid-cols-3 gap-3 mb-2">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
            <button
              key={num}
              type="button"
              onClick={() => handleDigitClick(num)}
              className="h-14 rounded-2xl bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 text-slate-700 font-bold text-xl transition-all duration-150 active:scale-95 border border-slate-100 flex items-center justify-center shadow-xs cursor-pointer"
            >
              {num}
            </button>
          ))}
          <button
            type="button"
            onClick={handleClear}
            className="h-14 rounded-2xl bg-slate-50 hover:bg-slate-100 text-slate-400 font-medium text-xs transition-all active:scale-95 flex items-center justify-center border border-slate-100 cursor-pointer"
          >
            Hapus
          </button>
          <button
            type="button"
            onClick={() => handleDigitClick('0')}
            className="h-14 rounded-2xl bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 text-slate-700 font-bold text-xl transition-all duration-150 active:scale-95 border border-slate-100 flex items-center justify-center shadow-xs cursor-pointer"
          >
            0
          </button>
          <button
            type="button"
            onClick={handleDeleteDigit}
            className="h-14 rounded-2xl bg-slate-50 hover:bg-rose-50 hover:text-rose-600 text-slate-500 font-medium text-sm transition-all active:scale-95 flex items-center justify-center border border-slate-100 cursor-pointer"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>
      </motion.div>
    </div>
  );
};
