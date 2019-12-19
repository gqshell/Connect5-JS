/*
	Joe O'Regan
	server.js
	Connect 5 - Multiplayer
*/
const express = require('express'),
	http = require('http');
socketio = require('socket.io');

var port = process.env.PORT || 3000;
var app = express();
var server = http.createServer(app);
var io = require('socket.io').listen(server);

app.use(express.static('static'));

const CONNECT = 5, ROWS = 6, COLS = 9;
const PLAYER_1 = 1, PLAYER_2 = 2;

var gamesPlayed = 0;
var games = [];									// Array of games

class Game {
	constructor(gameID) {
		this.gameID = gameID;
		this.currentPlayer = PLAYER_1;
		this.fiveInARow = Array(10).fill(0);
		this.gameOver = false;
		this.board = Array(6).fill().map(() => Array(9).fill(0));
		this.player1 = "";
		this.player2 = "";
	}

	getBoard() { return this.board; }
	setBoard(b) { this.board = b; }
	getGameOver() { return this.gameOver; }
	setGameOver(t) { this.gameOver = t; }
	getCurrentPlayer() { return this.currentPlayer; }
	setCurrentPlayer(p) { this.currentPlayer = p; }
	getPlayer1Name() { return this.player1; }
	getPlayer2Name() { return this.player2; }
	setPlayer1Name(p1) { this.player1 = p1; }
	setPlayer2Name(p2) { this.player2 = p2; }
	get5InARow() { return this.fiveInARow; }
	set5InARow(f) { this.fiveInARow = f; }

	resetGame(movesFirst) {
		this.currentPlayer = movesFirst;
		this.fiveInARow = Array(10).fill(0);
		this.gameOver = false;
		this.board = Array(6).fill().map(() => Array(9).fill(0));
	}
}

io.on('connection', (socket) => {
	console.log("New Connection");
	//socket.broadcast.emit('user.events', 'Player 2' + ' is online!');
	//socket.broadcast.to(data.gameID).emit('user.events', 'Player 2' + ' is online!');

	socket.on('create', (data) => {
		socket.join(`game-${++gamesPlayed}`);															// subscribe to a specific channel (game), join a room
		games[gamesPlayed] = new Game(gamesPlayed);														// Create a game with an increment of the number of games
		games[gamesPlayed].setPlayer1Name(data.username);												// Set Player 1 username				
		console.log('player 1 name set ');

		socket.emit('newGame', { username: data.username, gameID: `game-${gamesPlayed}` });
		console.log('Game-' + gamesPlayed + ' created by player 1: ' + data.username + '. Waiting on Player 2');// Log on server
	});

	socket.on('player2join', function (data) {
		var game = io.nsps['/'].adapter.rooms[data.gameID];
		//console.log('player2join gameID ' + data.gameID + " username " + data.username);

		if (game && game.length === 1) {
			console.log("player2join: Player 2: " + data.username + " has joined " + data.gameID);
			socket.join(data.gameID);

			games[parseInt(data.gameID.split('-')[1])].setPlayer2Name(data.username);					// Set Player 2 username
			games[parseInt(data.gameID.split('-')[1])].setCurrentPlayer(PLAYER_1);						// Set the first turn to player 1

			//socket.broadcast.to(data.gameID).emit('player1', {});
			socket.broadcast.to(data.gameID).emit('player1', { usernameP2: data.username });			// init player 1
			//socket.emit('player2', { username: data.username, gameID: data.gameID });					// player 2 username
			socket.emit('player2', { username: data.username, usernameP1: games[parseInt(data.gameID.split('-')[1])].getPlayer1Name(), gameID: data.gameID });	// SEND: player 2 username, player 1 username, gameID
		} else {
			socket.emit('err', { message: 'This game is already full' });
		}
	});

	socket.on('col', (data) => {
		index = parseInt(data.gameID.split('-')[1]);

		if (data.player === games[index].getCurrentPlayer()) {
			var goodMove = checkCol(data.column, index, data.gameID);									// check for each room

			if (goodMove) {
				io.to(data.gameID).emit((games[index].getGameOver()) ? 'gameWon' : 'turnPlayed', {
					board: games[index].getBoard(),
					column: data.column,
					gameID: data.gameID,																// data.gameID = room
					player: games[index].getCurrentPlayer()
				});
			}
		} else {
			console.log("Not Your Turn Player %s!", data.player);
			goodMove = false;
			/* NOTIFY THE PLAYER IT IS NOT THEIR TURN --- HTML */
		}

		if (!goodMove) {
			io.to(data.gameID).emit('badMove', {
				column: data.column,
				gameID: data.gameID,
				player: games[index].getCurrentPlayer()
			});
		}
	});
/*
	socket.on('gameOver', (data) => {
		socket.broadcast.to(data.gameID).emit('gameEnd', data);
	});
*/
	socket.on('resetGame', (data) => {
		console.log('\x1b[31m*** ' + data.gameID.toUpperCase() + ' RESET ***\x1b[0m');
		console.log('Game: ' + data.gameID + ' Reset by: ' + data.player);
		games[parseInt(data.gameID.split('-')[1])].resetGame(data.winner);
		socket.broadcast.to(data.gameID).emit('clearBoard', { player: data.player, gameID: data.gameID, winner: data.winner });
	});

	socket.on('leaveGame', (data) => {
		console.log('Player : ' + data.player + ' has left Game: ' + data.gameID);
		socket.broadcast.to(data.gameID).emit('shutdownMsg', data);
	});

	socket.on('disconnect', function () {
		console.log('Player  has disconnected');
	});

	socket.on('message', (data) => {
		console.log('MSG - ' + data.gameID + ' ' + data.username + ': ' + data.msg);
		//socket.broadcast.emit('message', message);	// broadcast to everyone except this
		socket.broadcast.to(data.gameID).emit('message', data);	// broadcast to everyone except this
	});
});

server.listen(port);
console.clear();																					// Clear console text
console.log("Server running at http://localhost: " + port);
displayBoard(Array(6).fill().map(() => Array(9).fill(0)), "");										// Show empty board to begin with

function checkCol(col, index, gameID) {
	var cb = games[index].getBoard();		// get the board
	console.log('game-' + index);
	console.log('Check Column ' + (col + 1) + ' For Player ' + games[index].getCurrentPlayer());			// show column number as displayed in console

	if (cb[0][col] != 0) {
		console.log('\x1b[31mError:\x1b[0m Column %s is full!', col);
	} else {
		for (var i = ROWS - 1; i >= 0; i--) {
			if (cb[i][col] == 0) {
				cb[i][col] = games[index].getCurrentPlayer();
				break;
			}
		}
		games[index].setBoard(cb);			// store the board
		displayBoard(cb, index);
		cb = null;

		checkWin(games[index].getCurrentPlayer(), parseInt(gameID.split('-')[1]));
		changePlayer(index); 																		// Move complete, change the active player
		return true;
	}

	return false;	// column is full
}

function checkWin(player, index) {
	var board = games[index].getBoard();

	// Diagonals
	var win = false;

	for (var row = 0; row <= ROWS - CONNECT; row++) {
		// up to right
		for (var col = CONNECT - 1; col < COLS; col++) {
			if (board[row][col] == player && board[row + 1][col - 1] == player && board[row + 2][col - 2] == player
				&& board[row + 3][col - 3] == player && board[row + 4][col - 4] == player) {
				win = true;
				//games[index].set5InARow(new Array(row,col,row+1,col-1,row+2,col-2,row+3,col-3,row+4,col-4)); // Highlight winning move
				games[index].set5InARow([row, col, row + 1, col - 1, row + 2, col - 2, row + 3, col - 3, row + 4, col - 4]); // Highlight winning move
				break;
			}
		}

		// up to left
		if (!win) {
			for (var col = 0; col <= COLS - CONNECT; col++) {
				if (board[row][col] == player && board[row + 1][col + 1] == player && board[row + 2][col + 2] == player
					&& board[row + 3][col + 3] == player && board[row + 4][col + 4] == player) {
					win = true;
					games[index].set5InARow([row, col, row + 1, col + 1, row + 2, col + 2, row + 3, col + 3, row + 4, col + 4]);
					break;
				}
			}
		} else {
			break;
		}
	}

	// Check Rows
	for (var row = 0; row < ROWS; row++) {
		for (var col = 0; col <= COLS - CONNECT; col++) {
			if (board[row][col] == player && board[row][col + 1] == player && board[row][col + 2] == player
				&& board[row][col + 3] == player && board[row][col + 4] == player) {
				win = true;
				games[index].set5InARow([row, col, row, col + 1, row, col + 2, row, col + 3, row, col + 4]);
				break;
			}
		}
		if (win) break; // no need for further checks
	}

	// Check Columns
	for (var row = 0; row <= ROWS - CONNECT; row++) {
		for (var col = 0; col < COLS; col++) {
			if (board[row][col] == player && board[row + 1][col] == player && board[row + 2][col] == player
				&& board[row + 3][col] == player && board[row + 4][col] == player) {
				win = true;
				games[index].set5InARow([row, col, row + 1, col, row + 2, col, row + 3, col, row + 4, col]);
				break;
			}
		}
		if (win) break;
	}

	if (win) {
		games[index].setGameOver(true);
		highlightWinner(player, board);
	}
}

function displayBoard(board, game) {
	var b = board;
	if (game == "") {
		console.log('\n  \x1b[36m%s\x1b[0m %s', 'Connect5', 'by Joe O\'Regan');  //cyan
	} else {
		console.log('\n  \x1b[36m%s\x1b[0m %s', 'Game: ', game);  //cyan
	}
	console.log('\x1b[34m_\x1b[0m1\x1b[34m__\x1b[0m2\x1b[34m__\x1b[0m3\x1b[34m__\x1b[0m4\x1b[34m__\x1b[0m5\x1b[34m__\x1b[0m6\x1b[34m__\x1b[0m7\x1b[34m__\x1b[0m8\x1b[34m__\x1b[0m9\x1b[34m_');

	for (var i = 0; i < ROWS; i++) { // display 0 to 5
		for (var j = 0; j < 9; j++) {
			process.stdout.write((b[i][j] === 0) ? '[\x1b[34m ]' : (b[i][j] == 1) ? '[\x1b[31mO\x1b[34m]' : (b[i][j] == 2) ? '[\x1b[33mO\x1b[34m]' : '[\x1b[32mO\x1b[34m]');
		}
		process.stdout.write('\n');
	}

	console.log("=".repeat(27));
	console.log('|        \x1b[36mCONNECT 5\x1b[34m        |');
	console.log("=".repeat(27) + "\x1b[0m");
	b = null;
}

// Highlight the winning row
function highlightWinner(player, finalBoard) {
	console.log("\n\x1b[32m" + "*".repeat(27) + '\n* Player ' + player + ' Is The Winner! *\n' + "*".repeat(27) + "\x1b[0m");
	var winBoard = finalBoard;

	for (var i = 0; i < (CONNECT * 2); i += 2) {
		winBoard[games[index].get5InARow()[i]][games[index].get5InARow()[i + 1]] = 3; // Highlight winning line
	}

	displayBoard(winBoard, 'over');
}

function changePlayer(index) {
	games[index].setCurrentPlayer((games[index].getCurrentPlayer() == PLAYER_1 && !games[index].getGameOver()) ? PLAYER_2 : PLAYER_1);	// If the game is not over change the current player, otherwise leave as is for winner message
}