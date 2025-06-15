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
  const container = document.getElementById("user-list-container");
  container.innerHTML = "";

  const playing = userList.filter(u => u.status.startsWith("Playing"));
  const waiting = userList.filter(u => u.status.startsWith("Waiting"));
  const idle = userList.filter(u => u.status === "Idle");

  if (playing.length > 0) {
    container.innerHTML += `<h3>Playing</h3>`;
    playing.forEach(u => {
      container.innerHTML += `<div class="user-row"><span>${u.screenName}</span><span>${u.status}</span></div>`;
    });
  }

  if (waiting.length > 0) {
    container.innerHTML += `<h3>Waiting for Opponent</h3>`;
    waiting.forEach(u => {
      // Only show JOIN button if it’s not yourself
      if (u.screenName !== currentUsername) {
        container.innerHTML += `
          <div class="user-row">
            <span>${u.screenName}</span>
            <button onclick="joinGame('${u.screenName}')">JOIN</button>
          </div>
        `;
      }
    });
  }

  if (idle.length > 0) {
    container.innerHTML += `<h3>Idle</h3>`;
    idle.forEach(u => {
      container.innerHTML += `<div class="user-row"><span>${u.screenName}</span><span>${u.status}</span></div>`;
    });
  }
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
