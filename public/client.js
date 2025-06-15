let currentUsername = "";

const socket = io();

socket.on("screenname-unavailable", () => {
  alert("That username is already in use.");
});

socket.on("LOGIN-OK", (userList) => {
  console.log("LOGIN-OK received. User list:", userList);

  document.getElementById("login-section").style.display = "none";
  document.getElementById("main-content").style.display = "block";
  updateList(userList);
});

socket.on("UPDATED-USER-LIST-AND-STATUS", (userList) => {
  updateList(userList);
});

function submitUsername() {
  const username = document.getElementById("username").value.trim();
  if (username.length === 0) {
    alert("Username cannot be blank.");
    return;
  }

  currentUsername = username;
  socket.emit("TO-SERVER LOGIN", username);
}

function updateList(userList) {
  const userTableBody = document.getElementById("user-table-body");
  const idleTable = document.getElementById("idle-table");

  userTableBody.innerHTML = "";
  idleTable.innerHTML = "";

  const processedPairs = new Set();

  // Render both waiting and playing in the X/O table
  userList.forEach(user => {
    const { screenName, status, symbol } = user;
    const row = document.createElement("tr");
    const xCell = document.createElement("td");
    const oCell = document.createElement("td");

    if (status.startsWith("Waiting as ")) {
      // waiting
      if (symbol === 'X') {
        xCell.textContent = screenName;
        oCell.innerHTML = `<button onclick="joinGame('${screenName}')">JOIN</button>`;
      } else {
        oCell.textContent = screenName;
        xCell.innerHTML = `<button onclick="joinGame('${screenName}')">JOIN</button>`;
      }
    } else if (status.startsWith("Playing vs ")) {
      // playing
      const opponent = status.split("Playing vs ")[1];
      // avoid double-rows
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
      return; // skip idle here
    }

    row.appendChild(xCell);
    row.appendChild(oCell);
    userTableBody.appendChild(row);
  });

  // Render idle players below
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

function promptNewGame() {
  document.getElementById("symbol-choice").style.display = "block";
}

function startNewGame(symbol) {
  document.getElementById("symbol-choice").style.display = "none";
  socket.emit("NEW-GAME", { screenName: currentUsername, symbol });
}

function joinGame(opponent) {
  if (opponent === currentUsername) return;
  socket.emit("JOIN", { screenName: currentUsername, opponent });
}
