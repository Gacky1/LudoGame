const socket = io();

let adminId = null;
let currentRoom = null;
let gameInstance = null;

function adminLogin() {
    const username = document.getElementById('adminUsername').value;
    const password = document.getElementById('adminPassword').value;
    // In a real application, you'd send these credentials to the server for verification
    if (username === 'admin' && password === 'password') {
        adminId = Math.random().toString(36).substr(2, 9);
        document.getElementById('createGame').style.display = 'block';
        alert('Admin logged in successfully');
    } else {
        alert('Invalid credentials');
    }
}

function createGame() {
    if (adminId) {
        socket.emit('createRoom', adminId);
    } else {
        alert('Please login as admin first');
    }
}

socket.on('roomCreated', (roomId) => {
    currentRoom = roomId;
    document.getElementById('roomCode').innerText = `Room Code: ${roomId}`;
});

function joinGame() {
    const playerName = document.getElementById('playerName').value;
    const roomId = document.getElementById('gameCode').value;
    if (playerName && roomId) {
        socket.emit('joinRoom', { roomId, playerName });
    } else {
        alert('Please enter your name and the game code');
    }
}

socket.on('joinError', (message) => {
    alert(message);
});

socket.on('playerJoined', (playerName) => {
    alert(`${playerName} has joined the game!`);
});

socket.on('gameStart', (players) => {
    alert('Game is starting!');
    document.getElementById('gameBoard').style.display = 'block';
    startGame(players);
});

function startGame(players) {
    const config = {
        type: Phaser.AUTO,
        width: 800,
        height: 600,
        parent: 'gameBoard',
        scene: {
            preload: preload,
            create: create,
            update: update
        }
    };

    gameInstance = new Phaser.Game(config);

    function preload() {
        this.load.svg('board', 'assets/ludo-board.svg');
        this.load.svg('dice', 'assets/dice.svg');
        this.load.svg('red', 'assets/red-piece.svg');
        this.load.svg('blue', 'assets/blue-piece.svg');
    }
    function create() {
        this.add.image(400, 300, 'board');
        
        this.diceButton = this.add.image(700, 500, 'dice').setInteractive();
        this.diceButton.on('pointerdown', rollDice, this);

        this.diceResult = this.add.text(700, 550, '', { fontSize: '32px', fill: '#fff' });

        this.pieces = [];
        const startPositions = [
            {x: 100, y: 100}, {x: 700, y: 100},
            {x: 100, y: 500}, {x: 700, y: 500}
        ];

        players.forEach((player, index) => {
            const piece = this.add.image(startPositions[index].x, startPositions[index].y, index % 2 === 0 ? 'red' : 'blue');
            piece.setScale(0.5);
            this.pieces.push(piece);
        });

        this.currentPlayer = 0;
        this.playerTurn = this.add.text(400, 50, `${players[this.currentPlayer].name}'s turn`, { fontSize: '24px', fill: '#fff' }).setOrigin(0.5);
    }

    function update() {
        // Game update logic here
    }

    function rollDice() {
        const result = Phaser.Math.Between(1, 6);
        this.diceResult.setText(result);
        // Implement move logic here
        this.currentPlayer = (this.currentPlayer + 1) % this.pieces.length;
        this.playerTurn.setText(`${players[this.currentPlayer].name}'s turn`);
    }
}

socket.on('gameUpdate', (gameState) => {
    // Update game based on server state
});

function sendMove(move) {
    socket.emit('playerMove', { room: currentRoom, move: move });
}

// ... (previous code remains the same)

function onPieceClick(pointer, gameObject) {
    if (!this.awaitingMove || gameObject.getData('player') !== this.currentPlayer) return;

    const currentPosition = gameObject.getData('position');
    const diceRoll = parseInt(this.diceResult.text);

    if (currentPosition === -1 && diceRoll === 6) {
        // Move out of starting area
        gameObject.setData('position', 0);
    } else if (currentPosition >= 0 && canMakeMove(gameObject, diceRoll)) {
        // Move along the board
        const newPosition = (currentPosition + diceRoll) % 52;
        gameObject.setData('position', newPosition);

        // Check for winning condition
        if (newPosition === 51) {
            this.time.delayedCall(500, () => {
                alert(`${players[this.currentPlayer].name} has won!`);
                sendGameResult(this.currentPlayer);
            });
        }
    } else {
        // Invalid move
        return;
    }

    this.awaitingMove = false;

    // Move to next player if dice roll wasn't 6
    if (diceRoll !== 6) {
        this.currentPlayer = (this.currentPlayer + 1) % players.length;
        this.playerTurn.setText(`${players[this.currentPlayer].name}'s turn`);
    }

    // Send move to server
    sendMove({
        player: this.currentPlayer,
        piece: this.pieces.indexOf(gameObject),
        position: gameObject.getData('position')
    });
}

function canMakeMove(piece, diceRoll) {
    const currentPosition = piece.getData('position');
    return currentPosition >= 0 && (currentPosition + diceRoll) <= 51;
}

function getCoordinatesForPosition(position) {
    // This is a simplified version. You'd need to calculate actual coordinates based on your board layout
    const x = 100 + (position % 13) * 50;
    const y = 100 + Math.floor(position / 13) * 50;
    return { x, y };
}

function getStartArea(player) {
    // Define start areas for each player
    const startAreas = [
        { x: 50, y: 50 },
        { x: 750, y: 50 },
        { x: 50, y: 550 },
        { x: 750, y: 550 }
    ];
    return startAreas[player];
}

function sendMove(move) {
socket.emit('playerMove', { room: currentRoom, move: move });
}

function sendGameResult(winner) {
socket.emit('gameOver', { room: currentRoom, winner: winner });
}

socket.on('gameUpdate', (gameState) => {
if (!gameInstance) return;

const scene = gameInstance.scene.scenes[0];

gameState.pieces.forEach((pieceState, index) => {
    const piece = scene.pieces[index];
    piece.setData('position', pieceState.position);
});

scene.currentPlayer = gameState.currentPlayer;
scene.playerTurn.setText(`${players[scene.currentPlayer].name}'s turn`);
scene.diceResult.setText(gameState.diceResult || '');
scene.awaitingMove = gameState.awaitingMove;
});

socket.on('gameOver', (winner) => {
alert(`Game Over! ${players[winner].name} has won!`);
// You might want to reset the game or return to the lobby here
});

// ... (rest of the code remains the same)