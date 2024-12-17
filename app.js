const { PrismaClient } = require('@prisma/client');
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const jwt = require('jsonwebtoken')
const bcrypt = require('bcrypt');
const userRouter = require('./routers/userRouter');
const cookieParser = require('cookie-parser');
const cors = require('cors'); 
const verifyToken = require('./middlewares/protected');
const docRouter = require('./routers/docRouter');

const app = express()

app.use(cors({// Replace with your frontend's URL
    credentials: true, // Allow cookies to be sent with requests
}));
app.use(express.json({ limit: '10mb' })); // Increase JSON payload limit
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(cookieParser())

app.use('/document',docRouter)

const server = http.createServer(app)
const wss = new WebSocket.Server({server})

const prisma = new PrismaClient();

prisma.$connect()
  .then(() => console.log('Database connected successfully'))
  .catch((error) => {
    //console.log(error)
    console.error('Error connecting to database:', "Something went wrong");
    
});

const rooms = new Map()
const locks = new Map()

const handleJoin = (ws,docId, userId, name) => {
    if (!rooms.has(docId)) {
      rooms.set(docId, []);
      locks.set(docId,{sharedLock:false,sharedSocket:null});
    }
    let {sharedLock,sharedSocket} = locks.get(docId)
    let roomUsers = rooms.get(docId);
    const newuser = {socket:ws,userId:userId,name,};
    const actualusers = roomUsers.filter((user) => user.userId !== userId);
    roomUsers = [...actualusers, newuser];

    

    rooms.set(docId, roomUsers); 
    //const roomUsers = rooms.get(docId); // Get the list of users in the room
    const sockets = roomUsers.map((user) => user.socket)

    // Broadcast the data to all users in the room except the sender
    wss.clients.forEach((client) => {
        if (
            client.readyState === WebSocket.OPEN &&
            client !== sharedSocket &&
            sockets.includes(client) // Check if the client belongs to the room
        ) {
            client.send(
                JSON.stringify({
                    type: 'current-users',
                    docId: docId,
                    userId: userId,
                    name : name,
                    users : roomUsers,
                    lock : sharedLock // Include the data to be shared
                })
            );
            
        }
        if(client.readyState === WebSocket.OPEN &&
            client !== ws &&
            sockets.includes(client)){
            client.send(
                JSON.stringify({
                    type: 'joined-user',
                    docId: docId,
                    userId: userId,
                    name : name,
                     // Include the data to be shared
                })
            );
        }
    });
    //console.log(`Room ${docId}:`, rooms.get(docId)); 
};
const handleDisconnect = (ws, docId, userId,name) => {
    if (!rooms.has(docId)) return; // If the room doesn't exist, exit
  
    const roomUsers = rooms.get(docId);
    const updatedUsers = roomUsers.filter((user) => user.userId !== userId); // Remove the user
    let {sharedLock,sharedSocket} = locks.get(docId)
  
    if (updatedUsers.length === 0) {
      rooms.delete(docId); // Remove the room if no users are left
      locks.delete(docId)
    } else {
      rooms.set(docId, updatedUsers); // Update the room with remaining users
      console.log(`Room ${docId}:`, rooms.get(docId));
    }

    const sockets = updatedUsers?.map((user) => user.socket)
    const user =  roomUsers.find((user) => user.userId === userId);
    if(sharedLock && user.socket === sharedSocket){
        locks.set(docId,{sharedLock:false,sharedSocket:null});
    }

    // Broadcast the data to all users in the room except the sender
    wss.clients.forEach((client) => {
        if (
            client.readyState === WebSocket.OPEN &&
            // Exclude the sender
            sockets.includes(client) // Check if the client belongs to the room
        ) {
            client.send(
                JSON.stringify({
                    type: 'current-users',
                    docId: docId,
                    userId: userId,
                    users : updatedUsers, // Include the data to be shared
                })
            );
            client.send(
                JSON.stringify({
                    type: 'disconnected-user',
                    docId: docId,
                    userId: userId, 
                    name: name// Include the data to be shared
                })
            );
        }
    });
  
    //console.log(`User ${userId} disconnected from Room ${docId}`);
};


const handleUpdate = (ws, docId, userId, data) => {
    if (!rooms.has(docId)) {
        console.log(`Room ${docId} does not exist`);
        return; // Exit if the room doesn't exist
    }

    const roomUsers = rooms.get(docId); // Get the list of users in the room
    const sockets = roomUsers.map((user) => user.socket)
    const user =  roomUsers.find((user) => user.userId === userId);

    
    // Broadcast the data to all users in the room except the sender
    wss.clients.forEach((client) => {
        if (
            client.readyState === WebSocket.OPEN &&
            // Exclude the sender
            sockets.includes(client) // Check if the client belongs to the room
        ) {
            client.send(
                JSON.stringify({
                    type: 'update-data',
                    docId: docId,
                    userId: userId,
                    name : user.name,
                    data: data, // Include the data to be shared
                })
            );
        }
    });
};

const handleLock = (ws, docId, userId, lock) => {
    if (!rooms.has(docId)) {
        console.log(`Room ${docId} does not exist`);
        return; // Exit if the room doesn't exist
    }
    const roomUsers = rooms.get(docId); // Get the list of users in the room
    const sockets = roomUsers.map((user) => user.socket)
    const user =  roomUsers.find((user) => user.userId === userId);
    // Broadcast the data to all users in the room except the sender
    let {sharedLock,sharedSocket} = locks.get(docId)    
    sharedLock = true
    sharedSocket = user.socket
    locks.set(docId,{sharedLock:true,sharedSocket:user.socket})
    wss.clients.forEach((client) => {
        if (
            client.readyState === WebSocket.OPEN &&
            client !== user.socket &&// Exclude the sender
            sockets.includes(client) // Check if the client belongs to the room
        ) {
            client.send(
                JSON.stringify({
                    type: 'update-lock',
                    docId: docId,
                    userId: userId,
                    lock : lock // Include the data to be shared
                })
            );
        }
    });
}
const releaseLock = (ws, docId, userId) => {
    if (!rooms.has(docId)) {
        console.log(`Room ${docId} does not exist`);
        return; // Exit if the room doesn't exist
    }
    const roomUsers = rooms.get(docId); // Get the list of users in the room
    const sockets = roomUsers.map((user) => user.socket)
    const user =  roomUsers.find((user) => user.userId === userId);
    // Broadcast the data to all users in the room except the sender
    locks.set(docId,{sharedLock:false,sharedSocket:null})
    wss.clients.forEach((client) => {
        if (
            client.readyState === WebSocket.OPEN &&
            client !== user.socket &&// Exclude the sender
            sockets.includes(client) // Check if the client belongs to the room
        ) {
            client.send(
                JSON.stringify({
                    type: 'release-lock',
                    docId: docId,
                    userId: userId,
                    lock : false // Include the data to be shared
                })
            );
        }
    });
}

const handleVersion = (ws, docId, userId, version,name) => {
    if (!rooms.has(docId)) {
        console.log(`Room ${docId} does not exist`);
        return; // Exit if the room doesn't exist
    }
    const roomUsers = rooms.get(docId); // Get the list of users in the room
    const sockets = roomUsers.map((user) => user.socket)
    const user =  roomUsers.find((user) => user.userId === userId);
    // Broadcast the data to all users in the room except the sender
    wss.clients.forEach((client) => {
        if (
            client.readyState === WebSocket.OPEN &&
            client !== user.socket &&// Exclude the sender
            sockets.includes(client) // Check if the client belongs to the room
        ) {
            client.send(
                JSON.stringify({
                    type: 'version',
                    docId: docId,
                    userId: userId,
                    version : version,
                    name : name // Include the data to be shared
                })
            );
        }
    });
}
const handleDeleteVersion = (ws, docId, userId, version,name) => {
    if (!rooms.has(docId)) {
        console.log(`Room ${docId} does not exist`);
        return; // Exit if the room doesn't exist
    }
    const roomUsers = rooms.get(docId); // Get the list of users in the room
    const sockets = roomUsers.map((user) => user.socket)
    const user =  roomUsers.find((user) => user.userId === userId);
    // Broadcast the data to all users in the room except the sender
    wss.clients.forEach((client) => {
        if (
            client.readyState === WebSocket.OPEN &&
            client !== user.socket &&// Exclude the sender
            sockets.includes(client) // Check if the client belongs to the room
        ) {
            client.send(
                JSON.stringify({
                    type: 'delete-version',
                    docId: docId,
                    userId: userId,
                    versionId : version,
                    name : name // Include the data to be shared
                })
            );
        }
    });
}
const handleSavedData = (ws, docId, userId, name) => {
    if (!rooms.has(docId)) {
        console.log(`Room ${docId} does not exist`);
        return; // Exit if the room doesn't exist
    }
    const roomUsers = rooms.get(docId); // Get the list of users in the room
    const sockets = roomUsers.map((user) => user.socket)
    const user =  roomUsers.find((user) => user.userId === userId);
    // Broadcast the data to all users in the room except the sender
    wss.clients.forEach((client) => {
        if (
            client.readyState === WebSocket.OPEN &&
            client !== user.socket &&// Exclude the sender
            sockets.includes(client) // Check if the client belongs to the room
        ) {
            client.send(
                JSON.stringify({
                    type: 'saved-data',
                    docId: docId,
                    userId: userId,
                    name  // Include the data to be shared
                })
            );
        }
    });
}
wss.on('connection',(ws) => {
    console.log("User is connected")

    ws.on('message', (data)=>{
        const { type , docId, userId} = JSON.parse(data);
        switch (type){
            case 'join-doc': 
                handleJoin(ws,docId,userId,JSON.parse(data).name)
                break;
            case 'close':
                handleDisconnect(ws,docId,userId,JSON.parse(data).name)
                break
            case 'update-data':
                handleUpdate(ws,docId,userId,JSON.parse(data).data)
                break
            case 'lock':
                handleLock(ws,docId,userId,JSON.parse(data).lock)
                break
            case 'release-lock':
                releaseLock(ws,docId,userId)
                break
            case 'close':
                handleDisconnect(ws,docId,userId)
                break
            case 'update-version':
                handleVersion(ws,docId,userId,JSON.parse(data).version,JSON.parse(data).name)
                break;
            case 'delete-version':
                handleDeleteVersion(ws,docId,userId,JSON.parse(data).versionId,JSON.parse(data).name)
                break
            case 'saved-data':
                handleSavedData(ws,docId,userId,JSON.parse(data).name)
                break
            default:
                console.log("Undefined Message")
        }
    })

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });

    ws.on('close', () => {
        console.log('WebSocket connection closed');
    });
})

app.use('/user',userRouter)


app.post('create',verifyToken, async (req,res) => {
    const {title , content} = req.body
})




server.listen(3000,()=>{
    console.log("Listening at port 3000")
})

process.on('SIGINT', async () => {
    await prisma.$disconnect();
    process.exit();
  });