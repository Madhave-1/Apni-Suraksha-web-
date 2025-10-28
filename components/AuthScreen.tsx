import React, { useState } from 'react';
import { Lock, Mail, User, Shield } from 'lucide-react';
import { auth, googleProvider } from '../firebase';
import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword,
    sendPasswordResetEmail,
    signInWithPopup,
    updateProfile
} from 'firebase/auth';

type AuthMode = 'login' | 'signup' | 'forgot';

// Component moved outside to prevent re-creation on render
const GoogleIcon = () => (
    <svg viewBox="0 0 48 48" className="w-5 h-5 mr-3">
        <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039L38.802 6.82C34.553 2.91 29.615 0 24 0C10.745 0 0 10.745 0 24s10.745 24 24 24s24-10.745 24-24c0-1.341-.138-2.65-.389-3.917z"></path><path fill="#FF3D00" d="M6.306 14.691c-1.229 2.222-1.994 4.86-1.994 7.309s.765 5.087 1.994 7.309l-5.305 4.14C.947 30.677 0 27.464 0 24s.947-6.677 2.401-9.458l5.305 4.14z"></path><path fill="#4CAF50" d="M24 48c5.615 0 10.553-2.91 14.802-7.18l-5.694-4.438c-1.883 1.286-4.383 2.068-7.108 2.068c-5.223 0-9.66-3.344-11.233-7.961L6.306 34.14C8.751 42.622 15.753 48 24 48z"></path><path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l5.694 4.438C44.912 34.622 48 29.745 48 24c0-1.341-.138-2.65-.389-3.917z"></path>
    </svg>
);

// Component moved outside to prevent re-creation on render
const InputField = ({ icon, ...props }: { icon: React.ReactNode; [key: string]: any }) => (
    <div className="relative flex items-center mb-4">
      <span className="absolute left-3 text-gray-400">{icon}</span>
      <input
        className="w-full pl-10 pr-4 py-2 border rounded-full bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary"
        {...props}
      />
    </div>
);

interface AuthFormProps {
  title: string;
  children: React.ReactNode;
  buttonText: string;
  onSubmit: (e: React.FormEvent) => Promise<void>;
  mode: AuthMode;
  isLoading: boolean;
  error: string | null;
  handleGoogleSignIn: () => Promise<void>;
}

// Component moved outside to prevent re-creation on render
const AuthForm: React.FC<AuthFormProps> = ({ title, children, buttonText, onSubmit, mode, isLoading, error, handleGoogleSignIn }) => (
    <div className="p-8 animate-fade-in">
        <div className="text-center mb-8">
            <Shield className="mx-auto h-16 w-16 text-primary" />
            <h1 className="text-3xl font-bold text-text-dark mt-2">Apni Suraksha</h1>
            <p className="text-text-light">{title}</p>
        </div>
        <form onSubmit={onSubmit}>
            {children}
            {error && <p className="text-red-500 text-sm text-center mb-4">{error}</p>}
            <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-primary text-white py-2 rounded-full font-bold hover:bg-primary-dark transition-colors duration-300 disabled:bg-gray-400"
            >
                {isLoading ? 'Processing...' : buttonText}
            </button>
        </form>
         {mode === 'login' && (
            <>
                <div className="my-4 flex items-center">
                    <div className="flex-grow border-t border-gray-300"></div>
                    <span className="flex-shrink mx-4 text-gray-400">OR</span>
                    <div className="flex-grow border-t border-gray-300"></div>
                </div>
                <button
                    onClick={handleGoogleSignIn}
                    disabled={isLoading}
                    className="w-full flex items-center justify-center bg-white border border-gray-300 text-text-dark py-2 rounded-full font-semibold hover:bg-gray-50 transition-colors duration-300 disabled:bg-gray-200"
                >
                    <GoogleIcon />
                    Sign in with Google
                </button>
            </>
        )}
    </div>
);

const AuthScreen: React.FC = () => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleResponseError = (errorCode: string) => {
    switch (errorCode) {
        case 'auth/user-not-found':
            return 'No account found with this email.';
        case 'auth/wrong-password':
            return 'Incorrect password. Please try again.';
        case 'auth/email-already-in-use':
            return 'This email is already registered.';
        case 'auth/weak-password':
            return 'Password should be at least 6 characters.';
        case 'auth/invalid-credential':
             return 'Incorrect email or password. Please try again.';
        default:
            return 'An unexpected error occurred. Please try again.';
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
        setError("Please enter both email and password.");
        return;
    }
    setIsLoading(true);
    setError(null);
    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
        setError(handleResponseError(err.code));
    } finally {
        setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) {
        setError("Please fill out all fields.");
        return;
    }
    setIsLoading(true);
    setError(null);
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        if (userCredential.user) {
            await updateProfile(userCredential.user, { displayName: name });
        }
    } catch (err: any) {
        setError(handleResponseError(err.code));
    } finally {
        setIsLoading(false);
    }
  };
  
  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
        setError("Please enter your email address.");
        return;
    }
    setIsLoading(true);
    setError(null);
    try {
        await sendPasswordResetEmail(auth, email);
        alert("Password reset link sent! Please check your email inbox.");
        setMode('login');
    } catch (err: any) {
        setError(handleResponseError(err.code));
    } finally {
        setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
      setIsLoading(true);
      setError(null);
      try {
          await signInWithPopup(auth, googleProvider);
      } catch (err: any) {
          setError(handleResponseError(err.code));
      } finally {
          setIsLoading(false);
      }
  };
  
  return (
    <div className="min-h-screen flex flex-col justify-center bg-primary-light">
      {mode === 'login' && (
        <AuthForm 
            title="Welcome Back" 
            buttonText="Login" 
            onSubmit={handleLogin}
            mode={mode}
            isLoading={isLoading}
            error={error}
            handleGoogleSignIn={handleGoogleSignIn}
        >
          <InputField icon={<Mail size={20} />} type="email" placeholder="Email" required value={email} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)} />
          <InputField icon={<Lock size={20} />} type="password" placeholder="Password" required value={password} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)} />
          <div className="text-right mb-6">
            <button type="button" onClick={() => setMode('forgot')} className="text-sm text-primary hover:underline">Forgot Password?</button>
          </div>
        </AuthForm>
      )}
      
      {mode === 'signup' && (
         <AuthForm 
            title="Create Your Account" 
            buttonText="Sign Up" 
            onSubmit={handleSignUp}
            mode={mode}
            isLoading={isLoading}
            error={error}
            handleGoogleSignIn={handleGoogleSignIn}
         >
            <InputField icon={<User size={20} />} type="text" placeholder="Full Name" required value={name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)} />
            <InputField icon={<Mail size={20} />} type="email" placeholder="Email" required value={email} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)} />
            <InputField icon={<Lock size={20} />} type="password" placeholder="Password" required value={password} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)} />
         </AuthForm>
      )}

      {mode === 'forgot' && (
         <AuthForm 
            title="Reset Password" 
            buttonText="Send Reset Link" 
            onSubmit={handlePasswordReset}
            mode={mode}
            isLoading={isLoading}
            error={error}
            handleGoogleSignIn={handleGoogleSignIn}
        >
            <InputField icon={<Mail size={20} />} type="email" placeholder="Enter your email" required value={email} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)} />
         </AuthForm>
      )}

      <div className="text-center p-4">
        {mode === 'login' && (
          <p className="text-text-light">
            Don't have an account? <button onClick={() => setMode('signup')} className="font-bold text-primary hover:underline">Sign Up</button>
          </p>
        )}
        {mode === 'signup' && (
          <p className="text-text-light">
            Already have an account? <button onClick={() => setMode('login')} className="font-bold text-primary hover:underline">Login</button>
          </p>
        )}
        {mode === 'forgot' && (
            <p className="text-text-light">
                Remembered your password? <button onClick={() => setMode('login')} className="font-bold text-primary hover:underline">Login</button>
            </p>
        )}
      </div>
    </div>
  );
};

export default AuthScreen;