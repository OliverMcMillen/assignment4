/**
 * Oliver McMillen
 * E01809181
 * COSC 436 - SEC 0
 * 
 * This file handles the client side logic for Tic Tac Toe game.
 */


const socket = io();
let currentUsername = "";
let xPlayer = "";
let oPlayer = "";
let mySymbol = "";
let opponentSymbol = "";
let isMyTurn = false;
let gameEnded = false;


// Socket react on screenname-unavailable
socket.on("screenname-unavailable", () => {
  usernameErrorOverlay();
});


// Socket react on LOGIN-OK
socket.on("LOGIN-OK", (userList) => {
  console.log("LOGIN-OK received. User list:", userList);

  // Hide login section
  document.getElementById("login-section").style.display = "none";

  // Show main content
  document.getElementById("main-content").style.display = "block";
  document.getElementById("current-login-status").style.display = "block";
  document.getElementById("current-login-status").textContent = `Logged in as: ${currentUsername}`;
  updateList(userList);
});

// Socket react on UPDATED-USER-LIST-AND-STATUS
socket.on("UPDATED-USER-LIST-AND-STATUS", (userList) => {
  updateList(userList);
});

// Socket react on PLAY
socket.on('PLAY', ({ xPlayer: xPlayer, oPlayer: oPlayer }) => {
  xPlayer = xPlayer;
  oPlayer = oPlayer;

  const gameSection = document.getElementById('game-section');
  const gameInfo = document.getElementById('game-info');
  const board = document.getElementById('board');
  gameSection.style.display = 'block';

  // clear previous board
  board.innerHTML = '';

  // Set current user and opponent symbols
  mySymbol = (currentUsername === xPlayer) ? 'X' : 'O';
  opponentSymbol = (mySymbol === 'X') ? 'O' : 'X';

  // Returns true if current user is 'X', false otherwise
  isMyTurn = (mySymbol === 'X'); // X always starts

  updateTurn();

  // Display the playing board
  for (let i = 1; i <= 9; i++) {
    const btn = document.createElement('button');
    btn.className = 'cell';

    // ensure buttons are enabled for the new game
    btn.disabled = false;
    btn.id = `cell-${i}`;

    // clear existing text
    btn.textContent = "";
    btn.addEventListener('click', () => {
      if (btn.textContent || !isMyTurn || gameEnded) return;
      btn.textContent = mySymbol;

      // Socket emit MOVE event 
      socket.emit('MOVE', { screenName: currentUsername, cell: i });
      isMyTurn = false;
      updateTurn();
    });
    board.appendChild(btn);
  }

  gameEnded = false;
});


// Socket react on MOVE
socket.on('MOVE', ({ cell }) => {
  const cellBtn = document.getElementById(`cell-${cell}`);
  if (cellBtn && !cellBtn.textContent) {

    // Determine if this move is made by the opponent or myself
    const isOpponentMove = !isMyTurn;
    const symbolToPlace = isOpponentMove ? opponentSymbol : mySymbol;
    cellBtn.textContent = symbolToPlace;

    const boardState = Array(10).fill('');
    for (let k = 1; k <= 9; k++) {
      boardState[k] = document.getElementById(`cell-${k}`).textContent;
    }

    // Delcare winning combinations
    const winCombos = [
      [1, 2, 3], [4, 5, 6], [7, 8, 9],
      [1, 4, 7], [2, 5, 8], [3, 6, 9],
      [1, 5, 9], [3, 5, 7]
    ];

    const isWin = winCombos.some(([a, b, c]) =>
      boardState[a] === symbolToPlace &&
      boardState[b] === symbolToPlace &&
      boardState[c] === symbolToPlace
    );

    // Detect if draw
    const isDraw = boardState.slice(1).every(cell => cell !== "");

    if (isWin != '' || isDraw != '') {
      gameEnded = true;

      // Disable all buttons
      for (let i = 1; i <= 9; i++) {
        const btn = document.getElementById(`cell-${i}`);
        if (btn && !btn.textContent) {
          btn.disabled = true;
        }
      }

      // Update game info
      console.log("Emitting END-GAME event");
      socket.emit("END-GAME", {
        winner: isWin ? symbolToPlace : "D",
        screenName: currentUsername
      });

      return;
    }

    isMyTurn = isOpponentMove;
    updateTurn();
  }
});


// Socket react on END-GAME
socket.on("END-GAME", ({ winner }) => {
  gameEnded = true;
  const gameInfo = document.getElementById('game-info');
  if (winner === "D") {
    gameInfo.textContent = "Game ended in a draw.";
  } else {
    gameInfo.textContent = `${winner} won!`;
  }

  // Disable all remaining buttons
  for (let i = 1; i <= 9; i++) {
    const btn = document.getElementById(`cell-${i}`);
    if (btn && !btn.textContent) {
      btn.disabled = true;
    }
  }
});


// Show how to play information
function showHowToPlay() {
  document.getElementById("helpOverlay").style.display = "flex";
  // Close Help Overlay
  document.getElementById("closeHelp").addEventListener("click", () => {
    document.getElementById("helpOverlay").style.display = "none";
  });
}


// Submit username function
function submitUsername() {
  const username = document.getElementById("username").value.trim();

  if (username.length === 0) {
    usernameErrorOverlay();
    return;
  }

  currentUsername = username;

  // Socket emit TO-SERVER LOGIN to server with the username
  socket.emit("TO-SERVER LOGIN", username);
}


function usernameErrorOverlay() {
  document.getElementById("usernameErrorOverlay").style.display = "flex";

  // Close Help Overlay
  document.getElementById("closeUsernameErr").addEventListener("click", () => {
    document.getElementById("usernameErrorOverlay").style.display = "none";
  });
}


function promptNewGame() {
  document.getElementById("symbol-choice").style.display = "block";
}


// Socket emit NEW-GAME to server with username and chosen 'X' or 'O' symbol
function startNewGame(symbol) {
  document.getElementById("symbol-choice").style.display = "none";
  socket.emit("NEW-GAME", { screenName: currentUsername, symbol });
}


function joinGame(opponent) {
  if (opponent === currentUsername) return;

  // Socket emit JOIN to server with current username and opponent
  socket.emit("JOIN", { screenName: currentUsername, opponent });
}


function updateTurn() {
  const gameInfo = document.getElementById('game-info');
  gameInfo.textContent = `X: ${xPlayer} | O: ${oPlayer} | Turn: ${isMyTurn ? mySymbol : opponentSymbol}`;
}


// Upodate the user list in the UI
function updateList(userList) {
  const userTableBody = document.getElementById("user-table-body");
  const idleTable = document.getElementById("idle-table");

  userTableBody.innerHTML = "";
  idleTable.innerHTML = "";

  const processedPairs = new Set();

  // Display both waiting and playing in the X/O table
  userList.forEach(user => {
    const { screenName, status, symbol } = user;
    const row = document.createElement("tr");
    const xCell = document.createElement("td");
    const oCell = document.createElement("td");

    if (status.startsWith("Waiting as ")) {
      // Display waiting status for X
      if (symbol === 'X') {
        xCell.textContent = screenName;
        oCell.innerHTML = `<a onclick="joinGame('${screenName}')">JOIN</a>`;
      } 
      // Set waiting status for O
      else {
        oCell.textContent = screenName;
        xCell.innerHTML = `<a onclick="joinGame('${screenName}')">JOIN</a>`;
      }
    } else if (status.startsWith("Playing vs ")) {
      const opponent = status.split("Playing vs ")[1];

      // Prevents duplicate games from showing in playing table
      const key = [screenName, opponent].sort().join(' | ');
      if (processedPairs.has(key)) return;
      processedPairs.add(key);

      // Display playing status for X
      if (symbol === 'X') {
        xCell.textContent = screenName;
        oCell.textContent = opponent;
      } 
      
      // Display playing status for O
      else {
        xCell.textContent = opponent;
        oCell.textContent = screenName;
      }
    } else {
      return;
    }

    row.appendChild(xCell);
    row.appendChild(oCell);
    userTableBody.appendChild(row);
  });

  // Display idle players
  userList.forEach(user => {
    if (user.status === 'Idle') {
      // Create row and cell
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 2;
      cell.textContent = user.screenName;
      row.appendChild(cell);
      idleTable.appendChild(row);
    }
  });
}
