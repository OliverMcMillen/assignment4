const socket = io();

function submitUsername() {
  const username = document.getElementById("username").value.trim();
  if (username) {
    socket.emit("TO-SERVER LOGIN", username);
  } else {
    alert("Username cannot be empty.");
  }
}