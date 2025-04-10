const express = require('express');
const http = require('http');
const socketio = require('socket.io');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config();

const connectDB = require('./db');
const Message = require('./models/Message');
const User = require('./models/user');

const app = express();
const server = http.createServer(app);
const io = socketio(server, { cors: { origin: '*' } });

const PORT = process.env.PORT || 3000;
const onlineUsers = new Map();

// ✅ Connect to MongoDB
connectDB();

// ✅ Middleware
app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ Routes
app.use('/api/auth', require('./routes/auth'));

// ✅ Health Check Route
app.get('/health', (req, res) => {
  res.json({
    status: 'Active',
    dbStatus: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
    timestamp: new Date()
  });
});

// ✅ Serve index.html manually (fix for redirect after login)
app.get('/index.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Optional: redirect root to login page
app.get('/', (req, res) => {
  res.redirect('/login.html');
});

// ✅ WebSocket Auth Middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('Authentication required'));

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return next(new Error('Invalid token'));
    socket.userId = decoded.id;
    next();
  });
});

// ✅ WebSocket Connection Handler
io.on('connection', async (socket) => {
  try {
    const user = await User.findById(socket.userId).lean();
    if (!user) return socket.disconnect(true);

    onlineUsers.set(user.username, { socketId: socket.id });

    io.emit('user-online', user.username);

    const allUsers = await User.find().select('username -_id').lean();
    const allUsernames = allUsers.map(u => u.username);

    socket.emit('users-list', {
      online: Array.from(onlineUsers.keys()),
      all: allUsernames
    });

    const offlineMessages = await Message.find({ receiver: user._id, status: 'sent' });
    if (offlineMessages.length > 0) {
      socket.emit('offline-messages', offlineMessages);
      await Message.updateMany({ receiver: user._id, status: 'sent' }, { $set: { status: 'delivered' } });
    }

    socket.on('private-message', async (msgData) => {
      try {
        if (!msgData?.content?.trim() || !msgData.receiverUsername) {
          throw new Error('Invalid message data');
        }

        const receiverUser = await User.findOne({ username: msgData.receiverUsername }).lean();
        if (!receiverUser) throw new Error('Receiver not found');

        const newMessage = new Message({
          content: msgData.content.trim(),
          sender: user._id,
          receiver: receiverUser._id,
          timestamp: Date.now(),
          status: onlineUsers.has(msgData.receiverUsername) ? 'delivered' : 'sent'
        });

        await newMessage.save();
        socket.emit('message-sent', newMessage);

        const receiverSocket = onlineUsers.get(receiverUser.username);
        if (receiverSocket) {
          io.to(receiverSocket.socketId).emit('private-message', {
            ...newMessage.toObject(),
            sender: user.username
          });
        }

      } catch (err) {
        socket.emit('error', { type: 'MESSAGE_ERROR', message: err.message });
      }
    });

    socket.on('disconnect', () => {
      onlineUsers.delete(user.username);
      io.emit('user-offline', user.username);
    });

  } catch (err) {
    console.error('Socket connection error:', err.message);
    socket.disconnect(true);
  }
});

// ✅ Start Server
server.listen(PORT, () => {
  console.log(`🚀 Chat Server running at http://localhost:${PORT}`);
});
