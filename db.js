/**
 * Oliver McMillen
 * E01809181
 * COSC 436 - SEC 0
 * 
 * This file handles the database connection for Tic Tac Toe game.
 */


const mysql = require('mysql2');

const db = mysql.createPool({
  host: 'localhost',
  user: '436_mysql_user',
  password: '123pwd456',
  database: '436db',
});

module.exports = db;