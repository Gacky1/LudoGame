const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const { Webhook, MessageBuilder } = require('discord-webhook-node');
const bcrypt = require('bcrypt');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

const rooms = new Map();
const hook = new Webhook("https://discord.com/api/webhooks/1284846894249676881/hxzePGPTkMAuzSx0KSv7Qs49A7OKPnYjoUVPwCsO8GpUMwtdG1LK7wDx_dkw0kVMK6Km");

const adminCredentials = {
    username: 'yoru',
    passwordHash: '$2b$10$X7o4c5/CpMD6kCT0vYZ9t.yDOsY3ZraSGmx9fW4YZzFvyIDmaxEzy'
};

app.post('/admin/login', async (req, res) => {
    const { username, password } = req.body;
    if (username === adminCredentials.username && await bcrypt.compare(password, adminCredentials.passwordHash)) {
        const adminId = Math.random().toString(36).substr(2, 9);
        res.json({ success: true, adminId });
    } else {
        res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
});

io.on('connection', (socket) => {
    console.log('New client connected');

    socket.on('createRoom', (adminId) => {
        const roomId = Math.random().toString(36).substr(2, 6).toUpperCase();
        rooms.set(roomId, { admin: adminId, players: [], gameState: {} });
        socket.join(roomId);
        socket.emit('roomCreated', roomId);
    });

    socket.on('joinRoom', ({ roomId, playerName }) => {
        const room = rooms.get(roomId);
        if (room && room.players.length < 2) {
            room.players.push({ id: socket.id, name: playerName });
            socket.join(roomId);
            socket.to(roomId).emit('playerJoined', playerName);
            if (room.players.length === 2) {
                io.to(roomId).emit('gameStart', room.players);
                initializeGame(roomId);
            }
        } else {
            socket.emit('joinError', 'Room full or does not exist');
        }
    });

    socket.on('playerMove', ({ room, move }) => {
        const gameState = rooms.get(room).gameState;
        
        // Update game state based on move
        gameState.pieces[move.piece].position = move.position;
        gameState.currentPlayer = move.player;
        gameState.awaitingMove = false;
        
        // Broadcast updated game state to all players in the room
        io.to(room).emit('gameUpdate', gameState);
    });

    socket.on('gameOver', ({ room, winner }) => {
        const gameState = rooms.get(room).gameState;
        gameState.winner = winner;
        
        // Broadcast game over to all players in the room
        io.to(room).emit('gameOver', winner);
        
        // Send result to Discord
        sendDiscordMessage(room, winner);
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected');
        // Handle player disconnect
        // ...
    });
});

function initializeGame(roomId) {
    const room = rooms.get(roomId);
    room.gameState = {
        currentPlayer: 0,
        diceResult: null,
        pieces: room.players.map(() => ({ position: -1 })),
        awaitingMove: false
    };
}

function sendDiscordMessage(room, winner) {
    const roomData = rooms.get(room);
    const embed = new MessageBuilder()
        .setTitle('Ludo Game Result')
        .setColor('#00ff00')
        .addField('Room', room)
        .addField('Winner', roomData.players[winner].name)
        .addField('Players', roomData.players.map(p => p.name).join(', '))
        .setTimestamp();

    hook.send(embed);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));