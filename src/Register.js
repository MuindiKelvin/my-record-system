import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from './firebase';
import logo from './logo/logo.png';
import { motion } from 'framer-motion';
import styled from 'styled-components';

const RegisterContainer = styled.div`
  min-height: 100vh;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px;
`;

const RegisterCard = styled(motion.div)`
  background: rgba(255, 255, 255, 0.95);
  border-radius: 20px;
  padding: 2rem;
  width: 100%;
  max-width: 450px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
  backdrop-filter: blur(10px);
`;

const LogoContainer = styled.div`
  position: relative;
  width: 120px;
  height: 120px;
  margin: 0 auto 2rem;
  cursor: pointer;
`;

const InputWrapper = styled.div`
  position: relative;
  margin-bottom: 1.5rem;
`;

const StyledInput = styled.input`
  width: 100%;
  padding: 12px 15px;
  border: none;
  border-radius: 25px;
  background: rgba(240, 240, 240, 0.9);
  transition: all 0.3s ease;
  &:focus {
    outline: none;
    background: white;
    box-shadow: 0 0 10px rgba(0, 123, 255, 0.3);
  }
`;

const FloatingLabel = styled.label`
  position: absolute;
  left: 15px;
  top: ${props => props.active ? '5px' : '50%'};
  transform: translateY(${props => props.active ? '0' : '-50%'});
  font-size: ${props => props.active ? '12px' : '16px'};
  color: ${props => props.active ? '#007bff' : '#666'};
  transition: all 0.3s ease;
  pointer-events: none;
`;

const GradientButton = styled(motion.button)`
  width: 100%;
  padding: 12px;
  border: none;
  border-radius: 25px;
  background: linear-gradient(45deg, #007bff, #00d4ff);
  color: white;
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 1px;
`;

const Register = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const particles = document.createElement('div');
    particles.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 0;
    `;
    document.body.appendChild(particles);

    for (let i = 0; i < 20; i++) {
      const particle = document.createElement('div');
      particle.style.cssText = `
        position: absolute;
        width: ${Math.random() * 5 + 2}px;
        height: ${Math.random() * 5 + 2}px;
        background: rgba(255, 255, 255, ${Math.random() * 0.3 + 0.1});
        border-radius: 50%;
        animation: float ${Math.random() * 10 + 5}s infinite;
      `;
      particle.style.left = `${Math.random() * 100}%`;
      particle.style.top = `${Math.random() * 100}%`;
      particles.appendChild(particle);
    }

    return () => document.body.removeChild(particles);
  }, []);

  const handleRegister = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (!email || !password || !confirmPassword) throw new Error('Please fill in all fields');
      if (!/\S+@\S+\.\S+/.test(email)) throw new Error('Invalid email format');
      if (password !== confirmPassword) throw new Error('Passwords do not match');
      if (password.length < 6) throw new Error('Password must be at least 6 characters');

      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      navigate('/login'); // Changed from '/projects' to '/login'
    } catch (err) {
      setError(err.message);
      setTimeout(() => setError(''), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <RegisterContainer>
      <style>
        {`
          @keyframes float {
            0% { transform: translateY(0); }
            50% { transform: translateY(-20vh); }
            100% { transform: translateY(0); }
          }
          @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.05); }
            100% { transform: scale(1); }
          }
        `}
      </style>
      <RegisterCard
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <LogoContainer as={motion.div}
          whileHover={{ rotate: 360 }}
          transition={{ duration: 0.8 }}
        >
          <img
            src={logo}
            alt="Logo"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              borderRadius: '50%',
              border: '3px solid transparent',
              background: 'linear-gradient(45deg, #007bff, #00d4ff) border-box'
            }}
          />
        </LogoContainer>

        <motion.h2
          initial={{ y: -20 }}
          animate={{ y: 0 }}
          className="text-center mb-4"
          style={{ color: '#1a1a2e', fontWeight: 'bold' }}
        >
          Create Account
        </motion.h2>

        <form onSubmit={handleRegister}>
          <InputWrapper>
            <StyledInput
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <FloatingLabel active={email.length > 0} htmlFor="email">
              Email Address
            </FloatingLabel>
          </InputWrapper>

          <InputWrapper>
            <StyledInput
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <FloatingLabel active={password.length > 0} htmlFor="password">
              Password
            </FloatingLabel>
          </InputWrapper>

          <InputWrapper>
            <StyledInput
              type="password"
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
            <FloatingLabel active={confirmPassword.length > 0} htmlFor="confirmPassword">
              Confirm Password
            </FloatingLabel>
          </InputWrapper>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-danger text-center mb-3"
            >
              {error}
            </motion.div>
          )}

          <GradientButton
            type="submit"
            disabled={isLoading}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            animate={isLoading ? { scale: [1, 1.05, 1] } : {}}
            transition={{ duration: 0.3, ...(isLoading && { repeat: Infinity }) }}
          >
            {isLoading ? 'Creating Account...' : 'Register'}
          </GradientButton>
        </form>

        <motion.div
          className="text-center mt-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <p style={{ color: '#666' }}>
            Already have an account?{' '}
            <motion.a
              href="/login"
              style={{ color: '#007bff', textDecoration: 'none' }}
              whileHover={{ color: '#00d4ff' }}
            >
              Sign In
            </motion.a>
          </p>
        </motion.div>
      </RegisterCard>
    </RegisterContainer>
  );
};

export default Register;