
import { useState, useEffect, useCallback } from 'react';

const SHAKE_THRESHOLD = 15; // m/s^2

export const useSensors = (onShake: () => void, onVoiceCommand: () => void) => {
  const [location, setLocation] = useState<GeolocationCoordinates | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);

  // Geolocation watcher
  useEffect(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return;
    }

    const watcher = navigator.geolocation.watchPosition(
      (position) => {
        setLocation(position.coords);
        setError(null);
      },
      (err) => {
        setError(err.message);
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0,
      }
    );

    return () => navigator.geolocation.clearWatch(watcher);
  }, []);

  // Shake detection
  useEffect(() => {
    let lastX: number, lastY: number, lastZ: number;
    let lastTimestamp = 0;

    const handleDeviceMotion = (event: DeviceMotionEvent) => {
      const { acceleration } = event;
      if (!acceleration || !acceleration.x || !acceleration.y || !acceleration.z) {
        return;
      }
      const now = Date.now();
      if (now - lastTimestamp < 100) return;

      if (lastX !== undefined) {
        const deltaX = Math.abs(acceleration.x - lastX);
        const deltaY = Math.abs(acceleration.y - lastY);
        const deltaZ = Math.abs(acceleration.z - lastZ);
        
        const speed = Math.sqrt(deltaX*deltaX + deltaY*deltaY + deltaZ*deltaZ) / (now - lastTimestamp) * 10000;
        
        if (speed > SHAKE_THRESHOLD) {
          onShake();
        }
      }
      
      lastX = acceleration.x;
      lastY = acceleration.y;
      lastZ = acceleration.z;
      lastTimestamp = now;
    };

    window.addEventListener('devicemotion', handleDeviceMotion);
    return () => window.removeEventListener('devicemotion', handleDeviceMotion);
  }, [onShake]);

  // Voice detection
  const toggleListening = useCallback(() => {
    // Fix: Cast window to any to access non-standard SpeechRecognition properties, which are not in the default TS Window interface.
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice recognition is not supported in your browser.");
      return;
    }
    
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      const transcript = event.results[event.results.length - 1][0].transcript.trim().toLowerCase();
      if (transcript.includes("help me")) {
        onVoiceCommand();
      }
    };
    
    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      if(isListening) {
         // Restart listening if it was intentionally on
         recognition.start();
      }
    };
    
    if (isListening) {
      recognition.stop();
      setIsListening(false);
    } else {
      try {
        recognition.start();
        setIsListening(true);
      } catch (e) {
        console.error("Could not start recognition", e);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isListening, onVoiceCommand]);

  return { location, error, isListening, toggleListening };
};
