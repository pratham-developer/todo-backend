require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const admin = require('firebase-admin');


const MONGO_URI=process.env.MONGO_URI;
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID;
const serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN_CREDENTIALS);
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: FIREBASE_PROJECT_ID
});

const app = express();

mongoose.connect(MONGO_URI).then(() => {
    console.log("MongoDB connected")
}).catch((err) => { 
    console.log("error", err) 
});

app.use(express.urlencoded({extended:false}));
app.use(express.json());

const apiKey = process.env.API_KEY;

// Task Schema
const taskSchema = new mongoose.Schema({
    userId: {type: String, required: true},
    title: {type: String, required: true},
    completed: {type: Boolean, default: false},
    createdAt: {type: Date, default: Date.now}
});

const Task = mongoose.model('Task', taskSchema, 'tasks');

// Authentication Middleware
const authenticate = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer')) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    const token = authHeader.split(' ')[1];
    try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        req.user = decodedToken;
        next();
    } catch (error) {
        return res.status(401).json({ message: 'Invalid Token' });
    }
};

// Task Routes
app.post(`/${apiKey}/tasks`, authenticate, async (req, res) => {
    const title = req.body.title;
    const userID = req.user.uid;
    try {
        const task = new Task({ userId: userID, title: title });
        await task.save();
        res.status(201).json(task);
        console.log("NEW DATA POSTED", task);
    } catch (err) {
        console.error('Error adding task:', err);
        res.status(500).json({ message: "Error adding task" });
    }
});

app.get(`/${apiKey}/tasks`, authenticate, async (req, res) => {
    try {
        const tasks = await Task.find({ userId: req.user.uid });
        res.status(200).json(tasks);
    } catch (error) {
        console.error('Error fetching tasks:', error);
        res.status(500).json({ message: "Error fetching tasks" });
    }
});

app.patch(`/${apiKey}/tasks/:id`, authenticate, async (req, res) => {
    try {
        const task = await Task.findById(req.params.id);
        if (!task || task.userId != req.user.uid) {
            return res.status(404).json({ message: "Task not found" });
        }
        task.completed = req.body.completed;
        await task.save();
        res.status(200).json(task);
    } catch (error) {
        res.status(500).json({ message: "error" });
    }
});

app.delete(`/${apiKey}/tasks`, authenticate, async (req, res) => {
    try {
        await Task.deleteMany({ userId: req.user.uid, completed: true });
        res.status(200).json({ message: "Deleted all completed tasks" });
    } catch (error) {
        res.status(500).json({ message: "error" });
    }
});

// Root Route
app.get('/', (req, res) => {
    res.json({ status: "working" });
});

app.listen(3000, () => {
    console.log("Running");
  });
  
module.exports = app;