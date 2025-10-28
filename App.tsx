import React, { useState, useEffect } from 'react';
import AuthScreen from './components/AuthScreen';
import MainScreen from './components/MainScreen';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from './firebase';
import { Shield } from 'lucide-react';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    
    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="bg-primary-light min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Shield className="mx-auto h-16 w-16 text-primary animate-pulse" />
          <h1 className="text-2xl font-bold text-text-dark mt-2">Apni Suraksha</h1>
          <p className="text-text-light">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-primary-light min-h-screen font-sans">
      <div className="max-w-md mx-auto bg-white shadow-lg min-h-screen">
        {user ? <MainScreen /> : <AuthScreen />}
      </div>
    </div>
  );
};

export default App;
