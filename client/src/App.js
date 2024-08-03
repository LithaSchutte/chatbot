import React, { useState, useEffect, useRef } from 'react';
import socketIOClient from "socket.io-client";

function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);
  const socketRef = useRef(null);

  useEffect(() => {
    // Fetch token from the server
    fetch('/get-token', { credentials: 'include' })
      .then(() => {
        // Connect to Socket.io server
        socketRef.current = socketIOClient({
          withCredentials: true
        });

        socketRef.current.on("receiveMessage", ({ response }) => {
          setMessages((prevMessages) => [...prevMessages, { text: response, sender: 'bot' }]);
        });

        socketRef.current.on('refresh page', () => {
          window.location.reload();
        });
      })
      .catch(error => {
        console.error('Error fetching token:', error);
      });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []); // Only run once on mount

  const sendMessage = () => {
    let message = input.trim();
    if (message.length !== 0 && socketRef.current) {
      socketRef.current.emit("sendMessage", message);
      setMessages((prevMessages) => [...prevMessages, { text: message, sender: 'user' }]);
      setInput('');
    }
  };

  const handleKeyPress = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      sendMessage();
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div id="main-parent">
      <header className="bg-dark text-white p-3">
        <h1 id="heading"> IntelliDrive Motors Chatbot </h1>
      </header>
      <main role="main" className="container chat-container">
        <div id="main-div" className="d-flex flex-column justify-content-between h-100">
          <div id="messages-sent" className="flex-grow-0 overflow-auto">
            {messages.map((message, index) => (
              <div key={index} className={`sent-message ${message.sender === 'user' ? 'client' : 'bot'}`}>
                {message.text}
              </div>
            ))}
            <div ref={messagesEndRef}/>
          </div>
          <div id="user-input" className="input-group my-3">
            <input
              id="inputfield"
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              className="form-control"
              placeholder="Send a message..."
            />
            <div className="input-group-append">
              <button id="send-button" className="btn btn-primary" onClick={sendMessage}>
                <i className="fa fa-paper-plane"></i>
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
