// We have to make a signaling channel 
// We will use Node JS and socket.io to handle this signaling channel.

// Node JS is our server
// Express handles all the paths
// Socket.io is our library for communication between client and server easily.

import express from 'express';
import { Server } from "socket.io";
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https'
import fs from 'fs'

//You can change the port here, but leave the IP to 0.0.0.0 so the server can listen to all incoming connections
const port = 8080
const ip = "0.0.0.0"

const privateKey = fs.readFileSync('cert.key', 'utf-8')
const certifcate = fs.readFileSync('cert.crt', 'utf-8')

const credentials = {
    key: privateKey,
    cert: certifcate
}

const app = express();
const server = https.createServer(credentials,app);
const io = new Server(server);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

//Our server is listening to messages sent from clients here.
io.on('connection', (socket)=> {
    console.log("a user has connected")

    socket.on('message', (msg) => {
  
        console.log("new message received: ", msg)

        socket.broadcast.emit("receiveMsg", msg);
    })

})

//This is used for routing for files
app.use('/js', express.static('js'));
app.use('/css', express.static('css'));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

server.listen(port, ip, () => {
  console.log('server has started');
});