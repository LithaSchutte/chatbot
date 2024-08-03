const express = require("express");
const http = require("http");
const { join } = require("path");
const socketIo = require("socket.io");
const fs = require("fs");
const {promisify} = require("util");
const PORT = process.env.PORT || 3001;
const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const jwt = require("jsonwebtoken")
const cors = require('cors')
const cookieParser = require('cookie-parser');

app.use(express.static(join(__dirname, '../client/build')));

const responsesFilePath = 'responses.json';
let responses = {};

const readFileAsync = promisify(fs.readFile);

(async () => {
    try {
        const data = await readFileAsync(responsesFilePath);
        responses = JSON.parse(data);
        //console.log("Responses loaded successfully")
    } catch (err) {
        console.error('Error reading or parsing JSON:', err);
    }
})();

const userStates = {};

const secretKeyPath = 'secret_key.txt'

// Read the secret key from the file
const user = {};
let secret_key;
try {
    secret_key = fs.readFileSync(secretKeyPath, 'utf8').trim();
} catch (err) {
    console.error('Error reading the secret key file:', err);
}

function isValidToken(token) {
    try {
        return jwt.verify(token, secret_key);
    } catch (err) {
        //"Token not Valid!"
        return false;
    }
}

app.use(cors());
app.use(cookieParser());

app.get('/get-token', (req, res) => {
    const token = jwt.sign(user, secret_key);
    res.cookie('token', token, { httpOnly: true });
    res.sendStatus(200);
})

io.use((socket, next) => {
    const token = socket.handshake.headers.cookie
        ? socket.handshake.headers.cookie.split('; ').find(row => row.startsWith('token=')).split('=')[1]
        : null;
    const validToken = isValidToken(token);
    if (validToken) {
        next();
    } else {
        console.log("Auth Err!");
    }
});

io.on("connection", (socket) => {
    //console.log("New client connected");
    userStates[socket.id] = { counter: 0 }; // Initialize counter in user state

    socket.emit("receiveMessage", { response: responses.default });

    socket.on("sendMessage", (message) => {
        let response;
        const lowerMessage = message.toLowerCase();

        if (!userStates[socket.id].context) {
            userStates[socket.id].context = "begin";
        }

        const findResponse = (keywords, context) => {
            for (let phrase in keywords[context]) {
                const regex = new RegExp(`\\b${phrase}\\b`, 'i');
                if (regex.test(lowerMessage)) {
                    return keywords[context][phrase];
                }
            }
            return null;
        };

        // Refresh the page if the user inputs are wrong too many times in a row
        function hardFallBack() {
            userStates[socket.id].counter += 1; // Increment counter
            if (userStates[socket.id].counter >= 4) {
                responseData = "It seems like we're having trouble understanding each other. Restarting the chat..."
                sleep().then(() => {
                    io.to(socket.id).emit('refresh page');
                    userStates[socket.id].counter = 0; // Reset counter
                });
            }
        }

        // Pause before refreshing the page after Hard Fallback
        function sleep() {
             return new Promise(resolve => setTimeout(resolve, 2000))
        }

        // Check context-specific responses first
        let responseData = findResponse(responses, userStates[socket.id].context);

        if (userStates[socket.id].context === "restart") {
            responseData = findResponse(responses, "restart");
        } else if (!responseData) {
            // Check basic keywords if context-specific response not found
            responseData = findResponse(responses, 'basic_keywords');
        }

        if (!responseData) {
            // Use default response in the current context if no match found
            if (responses[userStates[socket.id].context] && responses[userStates[socket.id].context].default) {
                responseData = responses[userStates[socket.id].context].default;
                hardFallBack();
            }
        }

        if (responseData) {
            if (responseData !== responses[userStates[socket.id].context].default) {
                userStates[socket.id].counter = 0;
            }
            if (typeof responseData === "string") {
                response = responseData; // Handle simple string response
            } else if (typeof responseData === "object" && responseData.answer) {
                response = responseData.answer; // Handle structured response with "answer"

                // Update context based on "switch" field in the response
                if (responseData.switch) {
                    userStates[socket.id].context = responseData.switch; 
                }
            }
        } else {
            // Fallback response if no specific or default response found
            response = "I'm sorry, I didn't understand that.";
            hardFallBack(); // Call hard fallback function
        }

        socket.emit("receiveMessage", { message, response });
    });

    socket.on("disconnect", () => {
        //console.log("Client disconnected");
        delete userStates[socket.id]; // Clean up user state on disconnect
    });
});

server.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
});