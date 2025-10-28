
import React, { useState, useEffect, useRef } from 'react';
import { Bot, X, Send } from 'lucide-react';
import { ChatMessage } from '../types';
import * as geminiService from '../services/geminiService';
import type { Chat } from '@google/genai';


interface ChatbotProps {
    onClose: () => void;
}

const Chatbot: React.FC<ChatbotProps> = ({ onClose }) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const chatRef = useRef<Chat | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        chatRef.current = geminiService.createChat();
        setMessages([{
            id: 'initial',
            text: 'Hello! I am your Suraksha Saathi. How can I help you today?',
            sender: 'bot'
        }]);
    }, []);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [messages]);

    const handleSend = async () => {
        if (!input.trim() || !chatRef.current) return;

        const userMessage: ChatMessage = { id: Date.now().toString(), text: input, sender: 'user' };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        const botResponseText = await geminiService.sendMessageToChatbot(chatRef.current, input);
        
        const botMessage: ChatMessage = { id: (Date.now() + 1).toString(), text: botResponseText, sender: 'bot' };
        setMessages(prev => [...prev, botMessage]);
        setIsLoading(false);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white w-full max-w-md h-[80vh] rounded-2xl shadow-xl flex flex-col animate-fade-in-up">
                <header className="p-4 border-b flex justify-between items-center bg-primary-light rounded-t-2xl">
                    <div className="flex items-center space-x-2">
                        <Bot className="text-primary-dark" />
                        <h2 className="font-bold text-primary-dark">Suraksha Saathi</h2>
                    </div>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800">
                        <X size={24} />
                    </button>
                </header>

                <main className="flex-grow p-4 overflow-y-auto space-y-4">
                    {messages.map(msg => (
                        <div key={msg.id} className={`flex items-end gap-2 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                            {msg.sender === 'bot' && <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white flex-shrink-0"><Bot size={20}/></div>}
                            <div className={`max-w-xs md:max-w-sm px-4 py-2 rounded-2xl ${msg.sender === 'user' ? 'bg-primary text-white rounded-br-none' : 'bg-gray-200 text-text-dark rounded-bl-none'}`}>
                                {msg.text}
                            </div>
                        </div>
                    ))}
                    {isLoading && (
                        <div className="flex justify-start gap-2">
                             <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white flex-shrink-0"><Bot size={20}/></div>
                            <div className="px-4 py-2 rounded-2xl bg-gray-200 text-text-dark rounded-bl-none">
                                <div className="flex items-center space-x-1">
                                    <span className="h-2 w-2 bg-gray-400 rounded-full animate-bounce delay-75"></span>
                                    <span className="h-2 w-2 bg-gray-400 rounded-full animate-bounce delay-150"></span>
                                    <span className="h-2 w-2 bg-gray-400 rounded-full animate-bounce delay-300"></span>
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </main>

                <footer className="p-4 border-t bg-white rounded-b-2xl">
                    <div className="flex items-center space-x-2">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                            placeholder="Type a message..."
                            className="w-full px-4 py-2 border rounded-full bg-gray-100 focus:outline-none focus:ring-2 focus:ring-primary"
                            disabled={isLoading}
                        />
                        <button onClick={handleSend} disabled={isLoading || !input.trim()} className="bg-primary text-white p-3 rounded-full disabled:bg-gray-300">
                            <Send size={20} />
                        </button>
                    </div>
                </footer>
            </div>
        </div>
    );
};

export default Chatbot;
