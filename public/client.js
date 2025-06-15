const socket = io();
let currentUsername = "";
let xPlayer = "";
let oPlayer = "";
let mySymbol = "";
let opponentSymbol = "";
let isMyTurn = false;

// Socket react on screenname-unavailable
socket.on("screenname-unavailable", () => {
  usernameErrorOverlay();
});

// Socket react on LOGIN-OK
socket.on("LOGIN-OK", (userList) => {
  console.log("LOGIN-OK received. User list:", userList);

  document.getElementById("login-section").style.display = "none";
  document.getElementById("main-content").style.display = "block";
  updateList(userList);
});

// Socket react on UPDATED-USER-LIST-AND-STATUS
socket.on("UPDATED-USER-LIST-AND-STATUS", (userList) => {
  updateList(userList);
});

// Socket react on PLAY
socket.on('PLAY', ({ xPlayer: xP, oPlayer: oP }) => {
  xPlayer = xP;
  oPlayer = oP;

  const gameSection = document.getElementById('game-section');
  const gameInfo = document.getElementById('game-info');
  const board = document.getElementById('board');

  gameSection.style.display = 'block';
  board.innerHTML = ''; // clear previous board

  mySymbol = (currentUsername === xPlayer) ? 'X' : 'O';
  opponentSymbol = (mySymbol === 'X') ? 'O' : 'X';
  isMyTurn = (mySymbol === 'X'); // X always starts

  updateTurn();

  for (let i = 1; i <= 9; i++) {
    const btn = document.createElement('button');
    btn.className = 'cell';
    btn.id = `cell-${i}`;
    btn.textContent = ""; // clear existing text
    btn.addEventListener('click', () => {
      if (btn.textContent || !isMyTurn) return;
      btn.textContent = mySymbol;
      socket.emit('MOVE', { screenName: currentUsername, cell: i });
      isMyTurn = false;
      updateTurn();
    });
    board.appendChild(btn);
  }
});


// Socket react on MOVE
socket.on('MOVE', ({ cell }) => {
  const cellBtn = document.getElementById(`cell-${cell}`);
  if (cellBtn && !cellBtn.textContent) {
    cellBtn.textContent = opponentSymbol;
    isMyTurn = true;
    updateTurn();
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

function usernameErrorOverlay(){
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
      // waiting
      if (symbol === 'X') {
        xCell.textContent = screenName;
        oCell.innerHTML = `<a onclick="joinGame('${screenName}')">JOIN</a>`;
      } else {
        oCell.textContent = screenName;
        xCell.innerHTML = `<a onclick="joinGame('${screenName}')">JOIN</a>`;
      }
    } else if (status.startsWith("Playing vs ")) {
      // playing
      const opponent = status.split("Playing vs ")[1];
      
      const key = [screenName, opponent].sort().join('|');
      if (processedPairs.has(key)) return;
      processedPairs.add(key);

      if (symbol === 'X') {
        xCell.textContent = screenName;
        oCell.textContent = opponent;
      } else {
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
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 2;
      cell.textContent = user.screenName;
      row.appendChild(cell);
      idleTable.appendChild(row);
    }
  });
}

