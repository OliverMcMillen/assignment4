# Read Me

To create tables for database, import init.sql file from project directory into desired database to create tables. 

CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    screenname VARCHAR(50) NOT NULL UNIQUE,
    login_time DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE players (
    x_player VARCHAR(50),
    o_player VARCHAR(50)
);
