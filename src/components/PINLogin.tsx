import React, { useState } from 'react';
import { Lock, Sparkles, ShieldCheck } from 'lucide-react';

interface PINLoginProps {
  onLogin: (pin: string) => Promise<void>;
  error: string | null;
  loading: boolean;
}

export default function PINLogin({ onLogin, error, loading }: PINLoginProps) {
  const [pin, setPin] = useState('');

  const handleKeyPress = (num: string) => {
    if (pin.length < 4) {
      const newPin = pin + num;
      setPin(newPin);
      if (newPin.length === 4) {
        onLogin(newPin);
      }
    }
  };

  const handleDelete = () => {
    setPin(pin.slice(0, -1));
  };

  const handleClear = () => {
    setPin('');
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-zinc-200 p-8 flex flex-col items-center">
        {/* Stall Header branding in Geometric Balance style */}
        <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-2xl shadow-sm mb-4">
          N
        </div>
        
        <h1 className="text-sm font-bold tracking-wider text-zinc-900 uppercase text-center leading-tight">
          NEWTONS
        </h1>
        <p className="text-[10px] text-zinc-400 tracking-widest uppercase mt-1 text-center">
          Collectables
        </p>
        <p className="text-[10px] text-zinc-400 font-semibold mt-1 bg-zinc-50 border border-zinc-200/60 px-2.5 py-1 rounded-md text-center">
          Bury St Edmunds Market • Wed & Sat
        </p>
        
        <div className="mt-8 mb-6 text-center">
          <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">Enter Personal PIN</p>
          <div className="flex justify-center gap-4">
            {[0, 1, 2, 3].map((index) => (
              <div
                key={index}
                className={`w-3.5 h-3.5 rounded-full border-2 transition-all duration-200 ${
                  pin.length > index
                    ? 'bg-blue-600 border-blue-600 scale-110 shadow-xs'
                    : 'border-zinc-300 bg-zinc-50'
                }`}
              />
            ))}
          </div>
        </div>

        {error && (
          <div className="w-full bg-red-50 border border-red-100 text-red-700 text-xs rounded-xl p-3 text-center mb-4 font-medium">
            {error}
          </div>
        )}

        {loading && (
          <div className="text-xs text-zinc-500 font-medium mb-4 flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            Authorizing secure session...
          </div>
        )}

        {/* Numeric Keypad */}
        <div className="grid grid-cols-3 gap-3 w-full max-w-[260px] mt-2 select-none">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
            <button
              id={`pin-btn-${num}`}
              key={num}
              onClick={() => handleKeyPress(num)}
              disabled={loading}
              className="h-14 w-full text-lg font-bold text-zinc-800 bg-zinc-100 hover:bg-zinc-200/80 active:bg-zinc-300 rounded-xl flex items-center justify-center transition-all focus:outline-none touch-manipulation select-none"
            >
              {num}
            </button>
          ))}
          <button
            id="pin-btn-clear"
            onClick={handleClear}
            disabled={loading}
            className="h-14 w-full text-xs font-bold text-zinc-400 hover:text-zinc-600 active:bg-zinc-100 rounded-xl flex items-center justify-center transition-colors focus:outline-none touch-manipulation select-none"
          >
            CLEAR
          </button>
          <button
            id="pin-btn-0"
            onClick={() => handleKeyPress('0')}
            disabled={loading}
            className="h-14 w-full text-lg font-bold text-zinc-800 bg-zinc-100 hover:bg-zinc-200/80 active:bg-zinc-300 rounded-xl flex items-center justify-center transition-all focus:outline-none touch-manipulation select-none"
          >
            0
          </button>
          <button
            id="pin-btn-del"
            onClick={handleDelete}
            disabled={loading}
            className="h-14 w-full text-xs font-bold text-zinc-400 hover:text-zinc-600 active:bg-zinc-100 rounded-xl flex items-center justify-center transition-colors focus:outline-none touch-manipulation select-none"
          >
            DELETE
          </button>
        </div>

        <div className="mt-8 flex items-center gap-1.5 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
          <Lock className="w-3.5 h-3.5 text-zinc-400" />
          Newton Secure Ledger
        </div>
      </div>
      <p className="text-[11px] text-zinc-400 font-medium mt-6 text-center">
        Tip: Master Control is <strong className="text-zinc-500">9999</strong>. Log in to register your own vendors.
      </p>
    </div>
  );
}
