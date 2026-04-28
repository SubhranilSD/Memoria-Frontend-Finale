import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../utils/api';
import './VaultOverlay.css';

export default function VaultOverlay({ user, onClose, onUnlocked }) {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(user?.hasVault ? 'verify' : 'setup_1'); 
  // steps: verify, setup_1, setup_2

  const handleDigit = (d) => {
    if (error) setError('');
    if (step === 'setup_2') {
      if (confirmPin.length < 4) setConfirmPin(prev => prev + d);
    } else {
      if (pin.length < 4) setPin(prev => prev + d);
    }
  };

  const handleBackspace = () => {
    if (error) setError('');
    if (step === 'setup_2') {
      setConfirmPin(prev => prev.slice(0, -1));
    } else {
      setPin(prev => prev.slice(0, -1));
    }
  };

  const handleSubmit = async () => {
    if (step === 'setup_1') {
      if (pin.length !== 4) { setError('PIN must be 4 digits'); return; }
      setStep('setup_2');
      return;
    }

    if (step === 'setup_2') {
      if (confirmPin !== pin) {
        setError('PINs do not match');
        setConfirmPin('');
        return;
      }
      setLoading(true);
      try {
        await api.post('/auth/vault/setup', { pin });
        // Auto-verify after setup
        const res = await api.post('/auth/vault/verify', { pin });
        localStorage.setItem('memoria_vault_token', res.data.vaultToken);
        onUnlocked();
      } catch (err) {
        setError(err.response?.data?.message || 'Setup failed');
      } finally {
        setLoading(false);
      }
      return;
    }

    if (step === 'verify') {
      if (pin.length !== 4) { setError('Enter 4 digits'); return; }
      setLoading(true);
      try {
        const res = await api.post('/auth/vault/verify', { pin });
        localStorage.setItem('memoria_vault_token', res.data.vaultToken);
        onUnlocked();
      } catch (err) {
        setError('Incorrect PIN');
        setPin('');
      } finally {
        setLoading(false);
      }
    }
  };

  const activePin = step === 'setup_2' ? confirmPin : pin;

  return (
    <div className="vault-overlay">
      <motion.div 
        className="vault-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div 
        className="vault-modal"
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
      >
        <button className="vault-close" onClick={onClose}>✕</button>
        
        <div className="vault-header">
          <div className="vault-icon">🔒</div>
          <h2>{step === 'verify' ? 'Unlock Vault' : 'Setup Vault'}</h2>
          <p>
            {step === 'verify' ? 'Enter your 4-digit PIN to access private memories.' :
             step === 'setup_1' ? 'Create a 4-digit PIN to secure private memories.' :
             'Confirm your 4-digit PIN.'}
          </p>
        </div>

        <div className="vault-dots">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className={`vault-dot ${i < activePin.length ? 'filled' : ''} ${error ? 'error' : ''}`} />
          ))}
        </div>

        {error && <div className="vault-error">{error}</div>}

        <div className="vault-numpad">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(d => (
            <button key={d} className="vault-num-btn" onClick={() => handleDigit(d.toString())}>{d}</button>
          ))}
          <button className="vault-num-btn" onClick={handleBackspace}>⌫</button>
          <button className="vault-num-btn" onClick={() => handleDigit('0')}>0</button>
          <button className="vault-num-btn action" onClick={handleSubmit} disabled={activePin.length !== 4 || loading}>
            {loading ? '...' : '→'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
