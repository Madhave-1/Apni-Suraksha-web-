
export enum Screen {
  Home = 'Home',
  Map = 'Map',
  Tips = 'Safety Tips',
  Profile = 'Profile',
}

export interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
}

export interface SafetyTip {
  title: string;
  content: string;
  category: string;
}

export interface ChatMessage {
    id: string;
    text: string;
    sender: 'user' | 'bot';
}

export interface SavedRoute {
  id: string;
  name: string;
  start: { lat: number, lng: number };
  end: { lat: number, lng: number };
}