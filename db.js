const mysql = require('mysql2');

const db = mysql.createPool({
  host: 'localhost',
  user: '436_mysql_user',
  password: '123pwd456',
  //need to change to '436db'
  database: 'assignment4db',
});

module.exports = db;