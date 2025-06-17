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

    // Find the existing game where the opponent is waiting (as X or O)
    dbCon.query(
      "SELECT * FROM players WHERE (x_player = ? AND o_player IS NULL) OR (o_player = ? AND x_player IS NULL) LIMIT 1",
      [opponent, opponent],
      (err, results) => {
        if (err || results.length === 0) {
          console.error("No waiting game found for opponent:", err);
          return;
        }

        const existing = results[0];
        const gameId = existing.id;
        const x = existing.x_player || screenName;
        const o = existing.o_player || screenName;

        // Update the existing game with the second player

          dbCon.query("INSERT INTO players (x_player, o_player) VALUES (?, ?)", [x, o], (err) => {
            if (err){
            console.error("Error updating game with JOIN:", err);
            return;
          }

          updateAndBroadcastUserList();

          const targetSockets = activeSockets.filter(u => [x, o].includes(u.screenName));
          targetSockets.forEach(each => {
            io.to(each.socketId).emit("PLAY", { xPlayer: x, oPlayer: o });
          });
        });
      }
    );
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

  // END-GAME event handler
  socket.on("END-GAME", ({ winner, screenName }) => {


      // Find the opponent
      const opponentQuery = `
        SELECT * FROM players
        WHERE x_player = ? OR o_player = ?
      `;
      dbCon.query(opponentQuery, [screenName, screenName], (err, results) => {
        let xPlayer = null;
        let oPlayer = null;

        if (results && results[0]) {
          xPlayer = results[0].x_player;
          oPlayer = results[0].o_player;
        }

        const targets = activeSockets.filter(u =>
          u.screenName === screenName || u.screenName === xPlayer || u.screenName === oPlayer
        );

        targets.forEach(each => {
          io.to(each.socketId).emit("END-GAME", { winner });
        });

      const cleanupQuery = `
      DELETE FROM players
      WHERE x_player = ? OR o_player = ?
    `;

    dbCon.query(cleanupQuery, [screenName, screenName], (err) => {
      if (err) {
        console.error("Error cleaning up game after END-GAME:", err);
        return;
      }
      console.log(`Game ended for ${screenName}. Winner: ${winner}`);
        updateAndBroadcastUserList();
      });
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