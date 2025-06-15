const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const app = express();
const server = http.createServer(app);
const io = new Server(server);
const activeSockets = []; // stores {screenName, socketId}
const dbCon = require('./db');

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Handle socket.io connections
io.on('connection', (socket) => {
  console.log(`New connection: ${socket.id}`);

  socket.on('TO-SERVER LOGIN', (screenName) => {

    // Check if screen name is already taken
    if (activeSockets.find(user => user.screenName === screenName)) {
      socket.emit("screenname-unavailable");
      return;
    }

    // Check if screenname is in DB already
    dbCon.query("SELECT * FROM users WHERE screenname = ?", [screenName], (err, result) => {
      if (err) {
        console.error("DB error during login check:", err);
        return;
      }

      if (result.length > 0) {
        socket.emit("screenname-unavailable");
      } else {
        // Add screenname to DB
        dbCon.query("INSERT INTO users (screenname) VALUES (?)", [screenName], (insertErr) => {
          if (insertErr) {
            console.error("DB insert error:", insertErr);
            return;
          }

          console.log(`User: '${screenName}' logged in with socket ID: ${socket.id}`);

          // add user to active sockets
          activeSockets.push({ screenName, socketId: socket.id });

          // Send the LOGIN-OK response
          updateAndBroadcastUserList(); // keep this modular
        });
      }
    });
  });

  // NEW-GAME
  socket.on("NEW-GAME", (data) => {
    const { screenName, symbol } = data;
    const x = symbol === "X" ? screenName : null;
    const o = symbol === "O" ? screenName : null;

    // Insert waiting player
    dbCon.query("INSERT INTO players (x_player, o_player) VALUES (?, ?)", [x, o], (err) => {
      if (err) {
        console.error("Error inserting new game:", err);
        return;
      }
      updateAndBroadcastUserList();
    });
  });

  // JOIN
  socket.on("JOIN", ({ screenName, opponent }) => {
    if (screenName === opponent) return;

    // Ensure both players are not already in a game
    dbCon.query("DELETE FROM players WHERE x_player = ? OR o_player = ? OR x_player = ? OR o_player = ?",
      [screenName, screenName, opponent, opponent], (err) => {
        if (err) {
          console.error("Error clearing old game:", err);
          return;
        }

        // Assign roles (if opponent was waiting as X, you become O, etc.)
        dbCon.query("SELECT * FROM players WHERE x_player = ? AND o_player IS NULL", [opponent], (err, results) => {
          if (err) return;

          const isOpponentX = results.length > 0;
          const x = isOpponentX ? opponent : screenName;
          const o = isOpponentX ? screenName : opponent;

          dbCon.query("INSERT INTO players (x_player, o_player) VALUES (?, ?)", [x, o], (err) => {
            if (err) return;
            updateAndBroadcastUserList();

            // Send PLAY to both players
            const targetSockets = activeSockets.filter(u => [x, o].includes(u.screenName));
            targetSockets.forEach(each => {
              io.to(each.socketId).emit("PLAY", { xPlayer: x, oPlayer: o });
            });
          });
        });
      });
  });

  // MOVE event handler
  socket.on('MOVE', ({ screenName, cell }) => {
    const opponentQuery = `
      SELECT x_player, o_player FROM players
      WHERE x_player = ? OR o_player = ?
      LIMIT 1
    `;
    dbCon.query(opponentQuery, [screenName, screenName], (err, results) => {
      if (err || results.length === 0) {
        console.error("Error finding opponent:", err);
        return;
      }

      const row = results[0];
      const opponent = (row.x_player === screenName) ? row.o_player : row.x_player;

      if (!opponent) return;

      const opponentSocket = activeSockets.find(u => u.screenName === opponent);
      if (opponentSocket) {
        io.to(opponentSocket.socketId).emit('MOVE', { cell });
      }
    });
  });

  socket.on('disconnect', () => {
    const index = activeSockets.findIndex(u => u.socketId === socket.id);
    if (index !== -1) {
      console.log(`User ${activeSockets[index].screenName} disconnected.`);
      activeSockets.splice(index, 1);
      updateAndBroadcastUserList();
    }
  });

  // Helper: get statuses and send to all clients
  function updateAndBroadcastUserList() {
    // Get list of current players
    dbCon.query("SELECT * FROM players", (err, players) => {
      if (err) {
        console.error("DB error retrieving players:", err);
        return;
      }

      // Format into [{ screenName, status, symbol }]
      const userList = activeSockets.map(user => {
        let status = "Idle";
        let symbol = null;
        players.forEach(game => {
          if (game.x_player === user.screenName) {
            symbol = 'X';
            status = game.o_player
              ? `Playing vs ${game.o_player}`
              : "Waiting as X";
          }
          if (game.o_player === user.screenName) {
            symbol = 'O';
            status = game.x_player
              ? `Playing vs ${game.x_player}`
              : "Waiting as O";
          }
        });
        return { screenName: user.screenName, status, symbol };
      });

      // Send updated list to the user who just logged in
      socket.emit("LOGIN-OK", userList);

      // Send the updated list to everyone else
      socket.broadcast.emit("UPDATED-USER-LIST-AND-STATUS", userList);
    });
  }


});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});