import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Home, Map as MapIcon, Shield, User, Heart, Mic, MicOff, X, Bot, Navigation, Route } from 'lucide-react';
import { Screen, EmergencyContact, SafetyTip, SavedRoute } from '../types';
import { useSensors } from '../hooks/useSensors';
import * as geminiService from '../services/geminiService';
import Chatbot from './Chatbot';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';

// Declare Leaflet's global variable `L` to TypeScript.
// This assumes leaflet.js is loaded via a script tag in the HTML.
declare const L: any;

// A simple debounce utility to limit how often a function is called.
const debounce = (func: Function, delay: number) => {
  let timeoutId: number;
  return (...args: any[]) => {
    window.clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => {
      func.apply(null, args);
    }, delay);
  };
};


// Define screen components outside MainScreen to prevent re-creation on re-renders
const HomeScreen: React.FC<{ location: GeolocationCoordinates | null }> = ({ location }) => {
    const [safetyStatus, setSafetyStatus] = useState("Analyzing your current location's safety...");

    useEffect(() => {
        if (location) {
            geminiService.analyzeSafetyOfArea(location.latitude, location.longitude)
                .then(setSafetyStatus);
        }
    }, [location]);

    return (
        <div className="p-6">
            <h2 className="text-2xl font-bold text-text-dark mb-4">Dashboard</h2>
            <div className="bg-primary-light p-4 rounded-lg shadow">
                <h3 className="font-bold text-primary-dark mb-2">Smart Mode Alert</h3>
                <p className="text-text-light">{safetyStatus}</p>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-4 text-center">
                <div className="bg-white p-4 rounded-lg shadow-md">
                    <Heart className="mx-auto h-8 w-8 text-primary" />
                    <p className="mt-2 font-semibold text-text-dark">Emergency Contacts</p>
                </div>
                <div className="bg-white p-4 rounded-lg shadow-md">
                    <Shield className="mx-auto h-8 w-8 text-primary" />
                    <p className="mt-2 font-semibold text-text-dark">Safety Tips</p>
                </div>
            </div>
        </div>
    );
};

interface MapScreenProps {
    location: GeolocationCoordinates | null;
    triggerSOS: (location: GeolocationCoordinates | null, contextMessage?: string) => void;
    routeToShow: SavedRoute | null;
    setRouteToShow: (route: SavedRoute | null) => void;
}

const MapScreen: React.FC<MapScreenProps> = ({ location, triggerSOS, routeToShow, setRouteToShow }) => {
    const mapContainer = useRef<HTMLDivElement>(null);
    const map = useRef<any | null>(null);
    const userMarker = useRef<any | null>(null);
    const safePlaceMarkers = useRef<any[]>([]);
    const safetyZoneLayers = useRef<any[]>([]);
    const routingControl = useRef<any | null>(null);
    const [currentRoute, setCurrentRoute] = useState<any | null>(null);

    const handleSaveRoute = () => {
        const routeName = prompt("Enter a name for this route:");
        if (routeName && currentRoute) {
            const waypoints = currentRoute.waypoints;
            const newRoute: SavedRoute = {
                id: Date.now().toString(),
                name: routeName,
                start: waypoints[0].latLng,
                end: waypoints[1].latLng,
            };
            const savedRoutes: SavedRoute[] = JSON.parse(localStorage.getItem('savedRoutes') || '[]');
            localStorage.setItem('savedRoutes', JSON.stringify([...savedRoutes, newRoute]));
            alert("Route saved!");
            setCurrentRoute(null);
            if (routingControl.current) {
                routingControl.current.setWaypoints([]);
            }
        }
    };


    const addSafePlaceMarkers = useCallback((places: any[], type: 'police' | 'hospital') => {
        if (!map.current || !location) return;

        places.forEach((place: any) => {
            if (!place.tags?.name) return;

            const iconHtml = `<div class="w-8 h-8 rounded-full flex items-center justify-center font-bold text-white shadow-md" style="background-color: ${type === 'police' ? '#3b82f6' : '#22c55e'};">${type === 'police' ? 'P' : 'H'}</div>`;
            const customIcon = L.divIcon({
                html: iconHtml,
                className: '',
                iconSize: [32, 32],
                iconAnchor: [16, 32],
                popupAnchor: [0, -32]
            });

            const placeName = place.tags.name;
            const placeType = type === 'police' ? 'Police Station' : 'Hospital';
            
            const popupNode = document.createElement('div');
            popupNode.className = 'text-center';
            popupNode.innerHTML = `<b>${placeType}</b><br>${placeName}`;

            const sosButton = document.createElement('button');
            sosButton.innerHTML = 'Trigger SOS Here';
            sosButton.className = "mt-2 w-full text-center px-2 py-1 bg-red-500 text-white text-sm font-semibold rounded-md hover:bg-red-600 transition-colors";
            sosButton.onclick = () => {
                const message = `Emergency! I am near ${placeName} (${placeType}) and need help.`;
                triggerSOS(location, message);
            };
            
            popupNode.appendChild(document.createElement('br'));
            popupNode.appendChild(sosButton);

            const newMarker = L.marker([place.lat, place.lon], { icon: customIcon })
                .addTo(map.current)
                .bindPopup(popupNode);

            safePlaceMarkers.current.push(newMarker);
        });
    }, [location, triggerSOS]);

    const updateSafetyZones = useCallback(async () => {
        if (!map.current) return;

        const bounds = map.current.getBounds();
        const center = bounds.getCenter();
        const zoom = map.current.getZoom();
        const radiusKm = Math.max(2, 40 / (zoom)); // Wider search on zoomed out maps

        try {
            // Using BikeWise API for theft incidents as a proxy for safety data
            const response = await fetch(`https://bikewise.org/api/v2/incidents?page=1&per_page=500&incident_type=theft&proximity=${center.lat},${center.lng}&proximity_square=${radiusKm}`);
            if (!response.ok) throw new Error('Failed to fetch incident data');
            const data = await response.json();
            const incidents = data.incidents;

            // Clear previous zones
            safetyZoneLayers.current.forEach(layer => layer.remove());
            safetyZoneLayers.current = [];

            if (!incidents || incidents.length === 0) return;

            // Create a grid over the map view to analyze incident density
            const GRID_DIVISIONS = 10;
            const latStep = (bounds.getNorth() - bounds.getSouth()) / GRID_DIVISIONS;
            const lngStep = (bounds.getEast() - bounds.getWest()) / GRID_DIVISIONS;

            for (let i = 0; i < GRID_DIVISIONS; i++) {
                for (let j = 0; j < GRID_DIVISIONS; j++) {
                    const cellSouth = bounds.getSouth() + i * latStep;
                    const cellNorth = cellSouth + latStep;
                    const cellWest = bounds.getWest() + j * lngStep;
                    const cellEast = cellWest + lngStep;
                    const cellBounds = L.latLngBounds([cellSouth, cellWest], [cellNorth, cellEast]);
                    
                    const incidentsInCell = incidents.filter((incident: any) => {
                        const lat = incident.location_coordinates?.[0];
                        const lon = incident.location_coordinates?.[1];
                        return lat && lon && cellBounds.contains([lat, lon]);
                    });

                    if (incidentsInCell.length > 0) {
                        let color = '#FACC15'; // Hex for yellow-400, matches legend
                        // Simple threshold for risk level
                        if (incidentsInCell.length > 2) {
                             color = '#EF4444'; // Hex for red-500, matches legend
                        }
                        
                        const zone = L.rectangle(cellBounds, {
                            color: color,
                            fillColor: color,
                            weight: 0,
                            fillOpacity: 0.4
                        }).addTo(map.current);
                        safetyZoneLayers.current.push(zone);
                    }
                }
            }
        } catch (error) {
            console.error("Failed to fetch safety zone data:", error);
        }
    }, []);

    const debouncedUpdateSafetyZones = useMemo(
        () => debounce(updateSafetyZones, 800),
        [updateSafetyZones]
    );

    // Initialize map on mount
    useEffect(() => {
        if (map.current || !mapContainer.current) return;

        if (typeof L === 'undefined' || typeof L.Control.Geocoder === 'undefined') {
            console.error("Leaflet or Leaflet Geocoder has not been loaded.");
            return;
        }
        
        try {
            const defaultCenter: [number, number] = [28.644800, 77.216721]; // Default to Delhi
            map.current = L.map(mapContainer.current, {
                center: defaultCenter,
                zoom: 14,
                zoomControl: false,
            });
            
            L.control.zoom({ position: 'topright' }).addTo(map.current);

            L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            }).addTo(map.current);
            
             const userIcon = L.divIcon({
                html: `<div class="w-6 h-6 bg-primary rounded-full border-4 border-white shadow-md animate-pulse"></div>`,
                className: '',
                iconSize: [24, 24],
                iconAnchor: [12, 12]
            });
            userMarker.current = L.marker(defaultCenter, { icon: userIcon })
                .addTo(map.current)
                .bindPopup("<b>Your Location</b>");
            
            // Add safety indicator legend to the map
            const legend = L.control({ position: 'bottomleft' });
            legend.onAdd = function () {
                const div = L.DomUtil.create('div', 'info legend bg-white bg-opacity-90 p-2 rounded-md shadow-md w-44');
                div.innerHTML = `
                    <h4 class="font-bold text-sm mb-1 text-text-dark">Safety Indicators</h4>
                    <div class="flex items-center space-x-2 mt-1"><i class="w-3 h-3 rounded-full inline-block" style="background: rgba(239, 68, 68, 0.5);"></i><span class="text-xs text-text-light">High Incident Area</span></div>
                    <div class="flex items-center space-x-2 mt-1"><i class="w-3 h-3 rounded-full inline-block" style="background: rgba(250, 204, 21, 0.5);"></i><span class="text-xs text-text-light">Moderate Incident Area</span></div>
                `;
                L.DomEvent.disableClickPropagation(div); // Prevent map clicks inside the legend
                return div;
            };
            legend.addTo(map.current);

            // Add routing control
            routingControl.current = L.Routing.control({
                waypoints: [
                    null, // Placeholder for start, will be filled by user location
                    null  // Placeholder for destination
                ],
                geocoder: L.Control.Geocoder.photon(), // Use Photon for better address suggestions
                routeWhileDragging: true,
                show: true, // Explicitly show the control
                lineOptions: {
                    styles: [{ color: '#F43F5E', opacity: 0.8, weight: 6 }]
                },
                useZoomParameter: true
            }).addTo(map.current);

            routingControl.current.on('routesfound', (e: any) => {
                if (e.routes && e.routes.length > 0) {
                    setCurrentRoute(e.routes[0]);
                }
            });

            map.current.on('moveend', debouncedUpdateSafetyZones);
            // Fetch safety zones for the initial view
            debouncedUpdateSafetyZones();

        } catch (error) {
            console.error("Failed to initialize Leaflet map:", error);
        }
        
        return () => {
            if (map.current) {
                map.current.off('moveend', debouncedUpdateSafetyZones);
                map.current.remove();
                map.current = null;
            }
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Update map when location changes & fetch safe places
    useEffect(() => {
        if (!map.current || !location) return;
        
        const newCenter: [number, number] = [location.latitude, location.longitude];

        if (userMarker.current) {
            map.current.flyTo(newCenter, 15);
            userMarker.current.setLatLng(newCenter).openPopup();
        }

        if (routingControl.current) {
            const waypoints = routingControl.current.getWaypoints();
            // Only set the start location if it hasn't been set by the user already.
            // This prevents overwriting a manually entered starting address.
            if (!waypoints[0] || !waypoints[0].latLng) {
                const startWaypoint = L.Routing.waypoint(
                    L.latLng(location.latitude, location.longitude),
                    'Your Current Location'
                );
                routingControl.current.spliceWaypoints(0, 1, startWaypoint);
            }
        }
        
        const fetchSafePlaces = async () => {
            const overpassUrl = 'https://overpass-api.de/api/interpreter';
            const { latitude: lat, longitude: lon } = location;
            const radius = 5000; // 5km

            const queries = {
                police: `[out:json];node["amenity"="police"](around:${radius},${lat},${lon});out;`,
                hospital: `[out:json];node["amenity"="hospital"](around:${radius},${lat},${lon});out;`
            };

            safePlaceMarkers.current.forEach(marker => marker.remove());
            safePlaceMarkers.current = [];
            
            try {
                let response = await fetch(overpassUrl, { method: 'POST', body: queries.police });
                let data = await response.json();
                if (data.elements) {
                   addSafePlaceMarkers(data.elements, 'police');
                }

                response = await fetch(overpassUrl, { method: 'POST', body: queries.hospital });
                data = await response.json();
                if (data.elements) {
                   addSafePlaceMarkers(data.elements, 'hospital');
                }
            } catch (error) {
                console.error("Failed to fetch safe places from Overpass API:", error);
            }
        };
        
        fetchSafePlaces();
        
    }, [location, addSafePlaceMarkers]);

    // Handle showing a saved route
    useEffect(() => {
        if (routeToShow && map.current && routingControl.current) {
            const { start, end } = routeToShow;
            routingControl.current.setWaypoints([
                L.latLng(start.lat, start.lng),
                L.latLng(end.lat, end.lng)
            ]);
            map.current.fitBounds(L.latLngBounds([start, end]));
            setRouteToShow(null); // Clear after showing
        }
    }, [routeToShow, setRouteToShow]);

    const handleRecenter = () => {
        if (map.current && location) {
            map.current.flyTo([location.latitude, location.longitude], 15);
        }
    };

    return (
        <div className="w-full h-full relative">
            <div ref={mapContainer} className="w-full h-full" />
             {currentRoute && (
                <button
                    onClick={handleSaveRoute}
                    className="absolute z-[1000] bottom-20 left-1/2 -translate-x-1/2 bg-primary text-white px-6 py-3 rounded-full shadow-lg font-bold hover:bg-primary-dark transition-colors"
                >
                    Save Route
                </button>
            )}
            <button
                onClick={handleRecenter}
                className="absolute z-[1000] bottom-4 right-4 bg-white p-3 rounded-full shadow-lg text-text-dark hover:bg-gray-100 transition-colors"
                aria-label="Recenter map"
                title="Recenter map"
            >
                <Navigation size={20} />
            </button>
        </div>
    );
};


const SafetyTipsScreen: React.FC = () => {
    const [tips, setTips] = useState<SafetyTip[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        geminiService.getSafetyTips().then(data => {
            setTips(data);
            setLoading(false);
        });
    }, []);

    if (loading) {
        return <div className="p-6 text-center text-text-light">Loading safety tips...</div>;
    }

    return (
        <div className="p-6">
            <h2 className="text-2xl font-bold text-text-dark mb-4">AI-Curated Safety Tips</h2>
            <div className="space-y-4">
                {tips.map((tip, index) => (
                    <div key={index} className="bg-primary-light p-4 rounded-lg shadow">
                        <h3 className="font-bold text-primary-dark">{tip.title} <span className="text-sm font-normal text-text-light">({tip.category})</span></h3>
                        <p className="text-text-dark mt-1">{tip.content}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

const ProfileScreen: React.FC<{ onViewRoute: (route: SavedRoute) => void }> = ({ onViewRoute }) => {
    const [contacts, setContacts] = useState<EmergencyContact[]>(() => {
        try {
            const savedContacts = localStorage.getItem('emergencyContacts');
            return savedContacts ? JSON.parse(savedContacts) : [];
        } catch (error) {
            console.error("Failed to parse contacts from localStorage", error);
            return [];
        }
    });
    const [newName, setNewName] = useState('');
    const [newPhone, setNewPhone] = useState('');

    const [savedRoutes, setSavedRoutes] = useState<SavedRoute[]>(() => {
        try {
            const routes = localStorage.getItem('savedRoutes');
            return routes ? JSON.parse(routes) : [];
        } catch (error) {
            return [];
        }
    });

    useEffect(() => {
        localStorage.setItem('emergencyContacts', JSON.stringify(contacts));
    }, [contacts]);

    const handleAddContact = (e: React.FormEvent) => {
        e.preventDefault();
        if (newName.trim() && newPhone.trim()) {
            setContacts(prev => [...prev, { id: Date.now().toString(), name: newName, phone: newPhone }]);
            setNewName('');
            setNewPhone('');
        }
    };

    const handleRemoveContact = (id: string) => {
        setContacts(prev => prev.filter(c => c.id !== id));
    };

    const handleRemoveRoute = (id: string) => {
        const updatedRoutes = savedRoutes.filter(r => r.id !== id);
        setSavedRoutes(updatedRoutes);
        localStorage.setItem('savedRoutes', JSON.stringify(updatedRoutes));
    };

    const handleLogout = async () => {
        try {
            await signOut(auth);
        } catch (error) {
            console.error("Error signing out", error);
            alert("Could not log out. Please try again.");
        }
    };

    return (
        <div className="p-6">
            <h2 className="text-2xl font-bold text-text-dark mb-4">Profile & Settings</h2>
            <div className="mb-6">
                <h3 className="font-bold text-primary-dark mb-2">Manage Emergency Contacts</h3>
                <form onSubmit={handleAddContact} className="bg-gray-100 p-4 rounded-lg mb-4">
                    <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Contact Name" className="w-full p-2 mb-2 border rounded" required />
                    <input type="tel" value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="Phone Number" className="w-full p-2 mb-2 border rounded" required />
                    <button type="submit" className="w-full bg-primary text-white py-2 rounded-full font-bold hover:bg-primary-dark transition-colors">Add Contact</button>
                </form>

                <div className="space-y-2">
                    {contacts.length === 0 && <p className="text-text-light text-center">No contacts added yet.</p>}
                    {contacts.map(c => (
                        <div key={c.id} className="bg-gray-50 p-3 rounded-lg flex justify-between items-center shadow-sm">
                           <div>
                                <p className="font-semibold text-text-dark">{c.name}</p>
                                <p className="text-text-light text-sm">{c.phone}</p>
                            </div>
                            <button onClick={() => handleRemoveContact(c.id)} className="text-red-500 hover:text-red-700">
                                <X size={20} />
                            </button>
                        </div>
                    ))}
                </div>
            </div>
            <div className="mb-6">
                <h3 className="font-bold text-primary-dark mb-2">Saved Routes</h3>
                 <div className="space-y-2">
                    {savedRoutes.length === 0 && <p className="text-text-light text-center">Plan a route on the map to save it here.</p>}
                    {savedRoutes.map(route => (
                        <div key={route.id} className="bg-gray-50 p-3 rounded-lg flex justify-between items-center shadow-sm">
                           <div className="flex items-center space-x-3">
                                <Route className="text-primary" size={20}/>
                                <p className="font-semibold text-text-dark">{route.name}</p>
                           </div>
                           <div className="flex items-center space-x-2">
                                <button onClick={() => onViewRoute(route)} className="text-primary hover:text-primary-dark font-semibold text-sm">View</button>
                                <button onClick={() => handleRemoveRoute(route.id)} className="text-red-500 hover:text-red-700">
                                    <X size={20} />
                                </button>
                           </div>
                        </div>
                    ))}
                </div>
            </div>
            <button
                onClick={handleLogout}
                className="w-full bg-accent text-white py-2 rounded-full font-bold hover:bg-primary-dark transition-colors"
            >
                Logout
            </button>
        </div>
    );
};


const SOSButton: React.FC<{ onClick: () => void }> = ({ onClick }) => (
    <button onClick={onClick} className="absolute -top-8 left-1/2 -translate-x-1/2 bg-red-500 text-white rounded-full w-20 h-20 flex items-center justify-center shadow-lg border-4 border-white animate-pulse z-20">
        <span className="text-2xl font-bold">SOS</span>
    </button>
);


const MainScreen: React.FC = () => {
    const [activeScreen, setActiveScreen] = useState<Screen>(Screen.Home);
    const [chatbotOpen, setChatbotOpen] = useState(false);
    const [routeToShow, setRouteToShow] = useState<SavedRoute | null>(null);
    
    const triggerSOS = useCallback((location: GeolocationCoordinates | null, contextMessage?: string) => {
        console.log("SOS TRIGGERED!");
        
        const contacts: EmergencyContact[] = JSON.parse(localStorage.getItem('emergencyContacts') || '[]');
        let alertMessage = "SOS Alert Triggered!\n";
        if (contacts.length > 0) {
            alertMessage += `Notifying your emergency contacts: ${contacts.map(c => c.name).join(', ')}.`;
        } else {
            alertMessage += "No emergency contacts found. Please add them in your profile to send alerts.";
        }
        alert(alertMessage);

        if (navigator.vibrate) {
            navigator.vibrate([500, 200, 500]);
        }
        
        const audio = new Audio('https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg');
        audio.play().catch(e => console.error("Error playing sound:", e));

        if (location && navigator.share) {
            const defaultMessage = `Emergency SOS from ${auth.currentUser?.displayName || 'a user'}! I need help! This is my current location: https://www.google.com/maps?q=${location.latitude},${location.longitude}`;
            const message = contextMessage ? `${contextMessage} My location: https://www.google.com/maps?q=${location.latitude},${location.longitude}` : defaultMessage;
            
            navigator.share({
                title: 'Emergency SOS',
                text: message,
            }).catch(e => console.error("Error sharing:", e));
        } else if (location) {
             const message = contextMessage ? `${contextMessage} My location: https://www.google.com/maps?q=${location.latitude},${location.longitude}` : `Emergency SOS! My location is latitude: ${location.latitude}, longitude: ${location.longitude}.`;
             navigator.clipboard.writeText(message).then(() => {
                alert("Emergency message with location copied to clipboard. Please paste and send it to your contacts.");
            });
        }
    }, []);

    const { location, error, isListening, toggleListening } = useSensors(() => triggerSOS(location), () => triggerSOS(location));

    const renderScreen = () => {
        switch (activeScreen) {
            case Screen.Home:
                return <HomeScreen location={location} />;
            case Screen.Map:
                return <MapScreen location={location} triggerSOS={triggerSOS} routeToShow={routeToShow} setRouteToShow={setRouteToShow} />;
            case Screen.Tips:
                return <SafetyTipsScreen />;
            case Screen.Profile:
                return <ProfileScreen onViewRoute={(route) => {
                    setRouteToShow(route);
                    setActiveScreen(Screen.Map);
                }}/>;
            default:
                return <HomeScreen location={location} />;
        }
    };
    
    const navItems = [
        { screen: Screen.Home, icon: Home },
        { screen: Screen.Map, icon: MapIcon },
        { screen: Screen.Tips, icon: Shield },
        { screen: Screen.Profile, icon: User },
    ];

    return (
        <div className="h-screen flex flex-col">
            <header className="p-4 flex justify-between items-center bg-white shadow-sm flex-shrink-0 z-10">
                <div className='flex items-center space-x-3'>
                    <Shield className="h-8 w-8 text-primary" />
                    <div>
                      <h1 className="text-xl font-bold text-primary">{activeScreen}</h1>
                      <p className="text-xs text-text-light">Welcome, {auth.currentUser?.displayName || 'User'}</p>
                    </div>
                </div>
                <button onClick={toggleListening} className={`p-2 rounded-full ${isListening ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'}`}>
                    {isListening ? <Mic size={24} /> : <MicOff size={24} />}
                </button>
            </header>
            
            <main className={`flex-grow relative bg-gray-50 ${activeScreen === Screen.Map ? 'overflow-hidden' : 'overflow-y-auto'}`}>
                {error && <div className="p-2 bg-red-100 text-red-700 text-center">{error}</div>}
                {renderScreen()}
                 <button
                    onClick={() => setChatbotOpen(true)}
                    className="absolute bottom-6 right-6 bg-primary text-white w-14 h-14 rounded-full shadow-lg flex items-center justify-center z-10"
                 >
                    <Bot size={28} />
                 </button>
            </main>

            {chatbotOpen && <Chatbot onClose={() => setChatbotOpen(false)} />}
            
            <footer className="relative h-20 bg-white shadow-[0_-2px_5px_-1px_rgba(0,0,0,0.1)] flex-shrink-0 z-10">
                <SOSButton onClick={() => triggerSOS(location)} />
                <nav className="h-full flex justify-around items-center pt-4">
                    {navItems.map(item => (
                        <button key={item.screen} onClick={() => setActiveScreen(item.screen)} className={`flex flex-col items-center space-y-1 ${activeScreen === item.screen ? 'text-primary' : 'text-gray-400'}`}>
                            <item.icon size={24} />
                            <span className="text-xs">{item.screen.split(' ')[0]}</span>
                        </button>
                    ))}
                </nav>
            </footer>
        </div>
    );
};

export default MainScreen;