// src/pages/Signup.js
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  FaGoogle, 
  FaEnvelope, 
  FaLock, 
  FaCheck, 
  FaTimes, 
  FaEye, 
  FaEyeSlash
} from 'react-icons/fa';
import { motion } from 'framer-motion';
import { auth, googleProvider, signInWithPopup, createUserWithEmailAndPassword } from '../firebase';

const Signup = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [passwordMatch, setPasswordMatch] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState({
    score: 0,
    message: '',
    color: 'red'
  });
  const [signupMethod, setSignupMethod] = useState('email'); // 'email' or 'phone'
  const navigate = useNavigate();

  useEffect(() => {
    // Check password match
    if (password && confirmPassword) {
      setPasswordMatch(password === confirmPassword);
    }
  }, [password, confirmPassword]);

  useEffect(() => {
    // Check password strength
    if (password) {
      const strength = checkPasswordStrength(password);
      setPasswordStrength(strength);
    } else {
      setPasswordStrength({
        score: 0,
        message: '',
        color: 'red'
      });
    }
  }, [password]);

  const checkPasswordStrength = (pass) => {
    let score = 0;
    
    // Length check
    if (pass.length > 5) score++;
    if (pass.length > 8) score++;
    
    // Complexity checks
    if (/[A-Z]/.test(pass)) score++;
    if (/[0-9]/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass)) score++;
    
    let message = '';
    let color = 'red';
    
    switch (score) {
      case 0:
      case 1:
        message = 'Very Weak';
        color = '#ff4d4d';
        break;
      case 2:
        message = 'Weak';
        color = '#ff7a45';
        break;
      case 3:
        message = 'Moderate';
        color = '#faad14';
        break;
      case 4:
        message = 'Strong';
        color = '#52c41a';
        break;
      case 5:
        message = 'Very Strong';
        color = '#389e0d';
        break;
      default:
        message = '';
    }
    
    return { score, message, color };
  };

  const handleGoogleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      navigate('/');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEmailSignUp = async (e) => {
    e.preventDefault();
    if (!passwordMatch) {
      setError("Passwords don't match");
      return;
    }
    if (passwordStrength.score < 3) {
      setError("Password is too weak");
      return;
    }
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      navigate('/');
    } catch (err) {
      setError(err.message);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const toggleSignupMethod = () => {
    setSignupMethod(signupMethod === 'email' ? 'phone' : 'email');
    setError('');
  };

  const styles = {
    authPage: {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      background: 'linear-gradient(145deg, #1a1a1a, #111111)',
      padding: '20px'
    },
    authContainer: {
      background: 'rgba(0, 0, 0, 0.7)',
      borderRadius: '15px',
      padding: '40px',
      width: '100%',
      maxWidth: '500px',
      boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
      border: '1px solid rgba(255, 215, 0, 0.2)',
      textAlign: 'center'
    },
    heading: {
      color: '#FFD700',
      marginBottom: '25px',
      fontSize: '1.8rem',
      fontWeight: '500'
    },
    errorMessage: {
      color: '#ff6b6b',
      background: 'rgba(255, 0, 0, 0.1)',
      padding: '12px',
      borderRadius: '5px',
      marginBottom: '20px',
      fontSize: '0.9rem'
    },
    socialAuth: {
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      marginBottom: '20px'
    },
    socialBtn: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '10px',
      padding: '12px',
      borderRadius: '30px',
      border: 'none',
      fontWeight: '500',
      cursor: 'pointer',
      transition: 'all 0.3s ease'
    },
    googleBtn: {
      background: '#4285F4',
      color: 'white'
    },
    divider: {
      display: 'flex',
      alignItems: 'center',
      margin: '20px 0',
      color: 'rgba(255, 255, 255, 0.5)'
    },
    dividerLine: {
      flex: 1,
      height: '1px',
      background: 'rgba(255, 255, 255, 0.1)'
    },
    dividerText: {
      padding: '0 15px'
    },
    authForm: {
      width: '100%'
    },
    inputGroup: {
      position: 'relative',
      marginBottom: '15px'
    },
    inputIcon: {
      position: 'absolute',
      left: '15px',
      top: '50%',
      transform: 'translateY(-50%)',
      color: 'rgba(255, 215, 0, 0.7)'
    },
    passwordToggle: {
      position: 'absolute',
      right: '15px',
      top: '50%',
      transform: 'translateY(-50%)',
      color: 'rgba(255, 255, 255, 0.5)',
      cursor: 'pointer'
    },
    input: {
      width: '100%',
      padding: '12px 15px 12px 45px',
      background: 'rgba(255, 255, 255, 0.05)',
      border: '1px solid rgba(255, 215, 0, 0.2)',
      borderRadius: '30px',
      color: 'white',
      fontSize: '0.95rem',
      transition: 'all 0.3s ease',
      '&:focus': {
        outline: 'none',
        borderColor: '#FFD700',
        boxShadow: '0 0 10px rgba(255, 215, 0, 0.2)'
      }
    },
    passwordFeedback: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: '5px',
      padding: '0 15px',
      fontSize: '0.8rem'
    },
    passwordMatch: {
      display: 'flex',
      alignItems: 'center',
      gap: '5px',
      color: '#52c41a'
    },
    passwordMismatch: {
      display: 'flex',
      alignItems: 'center',
      gap: '5px',
      color: '#ff4d4d'
    },
    strengthIndicator: {
      display: 'flex',
      alignItems: 'center',
      gap: '5px'
    },
    strengthBar: {
      height: '4px',
      borderRadius: '2px',
      background: '#333',
      flex: 1,
      margin: '0 5px',
      overflow: 'hidden'
    },
    strengthFill: {
      height: '100%',
      transition: 'all 0.3s ease'
    },
    submitBtn: {
      width: '100%',
      padding: '12px',
      background: 'linear-gradient(45deg, #FFD700, #FFA500)',
      border: 'none',
      borderRadius: '30px',
      color: '#111',
      fontWeight: '600',
      fontSize: '1rem',
      cursor: 'pointer',
      marginTop: '10px',
      transition: 'all 0.3s ease'
    },
    authFooter: {
      marginTop: '20px',
      color: 'rgba(255, 255, 255, 0.7)',
      fontSize: '0.9rem'
    },
    link: {
      color: '#FFD700',
      textDecoration: 'none'
    },
    switchMethod: {
      marginTop: '15px',
      color: '#FFD700',
      cursor: 'pointer',
      textDecoration: 'underline',
      fontSize: '0.9rem'
    }
  };

  return (
    <motion.div 
      style={styles.authPage}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div style={styles.authContainer}>
        <h2 style={styles.heading}>Create Your Account</h2>
        
        {error && <div style={styles.errorMessage}>{error}</div>}

        <div style={styles.socialAuth}>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            style={{ ...styles.socialBtn, ...styles.googleBtn }}
            onClick={handleGoogleSignIn}
          >
            <FaGoogle /> Continue with Google
          </motion.button>
        </div>

        <div style={styles.divider}>
          <div style={styles.dividerLine}></div>
          <span style={styles.dividerText}>OR</span>
          <div style={styles.dividerLine}></div>
        </div>

        {signupMethod === 'email' ? (
          <form style={styles.authForm} onSubmit={handleEmailSignUp}>
            <div style={styles.inputGroup}>
              <FaEnvelope style={styles.inputIcon} />
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={styles.input}
              />
            </div>
            
            <div style={styles.inputGroup}>
              <FaLock style={styles.inputIcon} />
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={styles.input}
              />
              <div 
                style={styles.passwordToggle}
                onClick={togglePasswordVisibility}
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </div>
            </div>
            
            {password && (
              <div style={styles.passwordFeedback}>
                <div style={styles.strengthIndicator}>
                  <span>Strength:</span>
                  <div style={styles.strengthBar}>
                    <div 
                      style={{ 
                        ...styles.strengthFill, 
                        width: `${passwordStrength.score * 20}%`,
                        background: passwordStrength.color
                      }} 
                    />
                  </div>
                  <span style={{ color: passwordStrength.color }}>
                    {passwordStrength.message}
                  </span>
                </div>
              </div>
            )}
            
            <div style={styles.inputGroup}>
              <FaLock style={styles.inputIcon} />
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Confirm Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                style={styles.input}
              />
              <div 
                style={styles.passwordToggle}
                onClick={togglePasswordVisibility}
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </div>
            </div>
            
            {confirmPassword && (
              <div style={styles.passwordFeedback}>
                <div style={passwordMatch ? styles.passwordMatch : styles.passwordMismatch}>
                  {passwordMatch ? (
                    <>
                      <FaCheck /> Passwords match
                    </>
                  ) : (
                    <>
                      <FaTimes /> Passwords don't match
                    </>
                  )}
                </div>
              </div>
            )}
            
            <motion.button
              type="submit"
              whileHover={{ scale: passwordMatch && passwordStrength.score >= 3 ? 1.02 : 1 }}
              whileTap={{ scale: passwordMatch && passwordStrength.score >= 3 ? 0.98 : 1 }}
              style={{
                ...styles.submitBtn,
                opacity: passwordMatch && passwordStrength.score >= 3 ? 1 : 0.7,
                cursor: passwordMatch && passwordStrength.score >= 3 ? 'pointer' : 'not-allowed'
              }}
              disabled={!passwordMatch || passwordStrength.score < 3}
            >
              Sign Up
            </motion.button>

            <div style={styles.switchMethod} onClick={toggleSignupMethod}>
              Or sign up with phone number
            </div>
          </form>
        ) : (
          <div style={{ textAlign: 'center', color: '#FFD700' }}>
            Phone authentication is currently not available. Please use email signup.
            <div style={styles.switchMethod} onClick={toggleSignupMethod}>
              Sign up with email instead
            </div>
          </div>
        )}

        <div style={styles.authFooter}>
          <p>Already have an account? <Link to="/" style={styles.link}>Go to Home</Link></p>
        </div>
      </div>
    </motion.div>
  );
};

export default Signup;
