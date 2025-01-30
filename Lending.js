// Importing dependencies
import mongoose from "mongoose";
import express from "express";
import { v4 as uuid } from "uuid";
import cors from "cors";
import path from "path";
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import bcrypt from "bcrypt";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// CORS configuration
app.use(cors());

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// MongoDB URI
const dbURI = process.env.MONGODB_URI || "mongodb+srv://kawin:saipranavika17@kawin.lozfqbm.mongodb.net/LendingDB?retryWrites=true&w=majority";

// Port configuration
const PORT = process.env.PORT || 3000;

// Connect to MongoDB
const startServer = async () => {
    try {
        await mongoose.connect(dbURI, { 
            useNewUrlParser: true, 
            useUnifiedTopology: true 
        });
        console.log("Connected to the database successfully");

        // Start the server
        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });
    } catch (err) {
        console.error("Database connection failed:", err);
        process.exit(1);
    }
};

// Define User Schema
const userSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
});
const User = mongoose.model("User", userSchema);

// Define Item Schema
const itemSchema = new mongoose.Schema({
    id: { type: String, default: uuid, unique: true },
    name: { type: String, required: true },
    description: { type: String, required: true },
    ownerId: { type: String, required: true, ref: 'User' },
    status: { type: String, enum: ['available', 'borrowed'], default: 'available' }
});
const Item = mongoose.model("Item", itemSchema);

// Define Transaction Schema
const transactionSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    itemId: { type: String, required: true, ref: 'Item' },
    lenderId: { type: String, required: true, ref: 'User' },
    borrowerId: { type: String, required: true, ref: 'User' },
    status: { 
        type: String, 
        enum: ['pending', 'approved', 'rejected', 'cancelled'],
        default: "pending" 
    },
    startDate: { type: Date, default: Date.now },
    endDate: { type: Date },
    borrowDate: { type: Date }
});
const Transaction = mongoose.model("Transaction", transactionSchema);

// Root endpoint
app.get('/', (req, res) => {
    res.json({ message: 'Welcome to LendingApp API' });
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date() });
});

// User Routes
app.post("/api/users/register", async (req, res) => {
    try {
        console.log('Received registration request:', req.body);
        const { name, email, password } = req.body;
        
        if (!name || !email || !password) {
            console.log('Missing required fields:', { name: !!name, email: !!email, password: !!password });
            return res.status(400).json({ message: "All fields are required" });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(409).json({ message: "Email already in use" });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        const userId = uuid();

        const newUser = new User({ 
            id: userId, 
            name, 
            email, 
            password: hashedPassword 
        });
        
        const savedUser = await newUser.save();
        
        res.status(201).json({ 
            message: "User registered successfully",
            userId: savedUser.id,
            name: savedUser.name,
            email: savedUser.email
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: "Registration failed. Please try again." });
    }
});

// Login Route
app.post("/api/users/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        
        if (!user) {
            return res.status(401).json({ message: "Invalid email or password" });
        }
        
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ message: "Invalid email or password" });
        }
        
        res.json({
            message: "Login successful",
            userId: user.id,
            name: user.name,
            email: user.email
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: "Login failed. Please try again." });
    }
});

// Get User Details
app.get("/api/users/:userId", async (req, res) => {
    try {
        const { userId } = req.params;
        console.log('Fetching user details for:', userId);

        const user = await User.findOne({ id: userId });
        if (!user) {
            console.log('User not found:', userId);
            return res.status(404).json({ message: 'User not found' });
        }

        console.log('User found:', user.email);
        res.json({
            userId: user.id,
            name: user.name,
            email: user.email
        });
    } catch (err) {
        console.error('Error fetching user:', err);
        res.status(500).json({ message: 'Error fetching user details' });
    }
});

// Get All Users
app.get("/api/users", async (req, res) => {
    try {
        const users = await User.find();
        res.status(200).json(users);
    } catch (err) {
        console.error("Error fetching users:", err);
        res.status(500).json({ message: "Failed to fetch users" });
    }
});

// Item Routes
// Add Item
app.post("/api/items", async (req, res) => {
    try {
        const { name, description, ownerId } = req.body;
        
        if (!name || !description || !ownerId) {
            return res.status(400).json({ message: "All fields are required" });
        }

        // Verify that the owner exists
        const owner = await User.findOne({ id: ownerId });
        if (!owner) {
            return res.status(404).json({ message: "Owner not found" });
        }

        const newItem = new Item({
            name,
            description,
            ownerId: owner.id,
            status: 'available'
        });

        const savedItem = await newItem.save();
        console.log('Created item:', savedItem);
        
        res.status(201).json({ 
            message: "Item created successfully", 
            item: {
                ...savedItem.toObject(),
                owner: {
                    name: owner.name,
                    email: owner.email
                }
            }
        });
    } catch (err) {
        console.error('Error creating item:', err);
        res.status(500).json({ message: "Failed to create item", error: err.message });
    }
});

// Get all items with owner details
app.get("/api/items", async (req, res) => {
    try {
        console.log('Fetching items...');
        const items = await Item.find().lean();
        console.log('Found items:', items);
        
        if (!items.length) {
            return res.json([]);
        }

        // Get all unique owner IDs
        const ownerIds = [...new Set(items.map(item => item.ownerId))];
        console.log('Owner IDs:', ownerIds);
        
        // Fetch all owners in one query
        const owners = await User.find({ id: { $in: ownerIds } });
        console.log('Found owners:', owners);
        
        // Create a map of owner IDs to owner details
        const ownerMap = owners.reduce((map, owner) => {
            map[owner.id] = {
                name: owner.name,
                email: owner.email
            };
            return map;
        }, {});
        
        // Add owner details to each item
        const itemsWithOwners = items.map(item => ({
            ...item,
            _id: item._id.toString(),
            owner: ownerMap[item.ownerId] || { 
                name: 'Unknown User',
                email: ''
            }
        }));

        console.log('Sending items with owners:', itemsWithOwners);
        res.json(itemsWithOwners);
    } catch (err) {
        console.error('Error fetching items:', err);
        res.status(500).json({ message: "Error fetching items", error: err.message });
    }
});

// Update Item Availability
app.put("/api/items/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { available } = req.body;
        
        if (available === undefined) {
            return res.status(400).json({ message: "Available status is required" });
        }

        const updatedItem = await Item.findOneAndUpdate(
            { id },
            { available },
            { new: true }
        );

        if (!updatedItem) {
            return res.status(404).json({ message: "Item not found" });
        }

        res.status(200).json({ message: "Item updated successfully", data: updatedItem });
    } catch (err) {
        console.error("Error updating item:", err);
        res.status(500).json({ message: "Failed to update item" });
    }
});

// Transaction Routes
// Create Transaction (Borrow Request)
app.post("/api/transactions", async (req, res) => {
    try {
        const { itemId, borrowerId } = req.body;
        
        // Find the item first
        const item = await Item.findOne({ id: itemId });
        if (!item) {
            console.log(`Item not found with id: ${itemId}`);
            return res.status(404).json({ message: "Item not found" });
        }

        // Check if user is trying to borrow their own item
        if (item.ownerId === borrowerId) {
            console.log(`User ${borrowerId} attempted to borrow their own item ${itemId}`);
            return res.status(400).json({ 
                message: "You cannot borrow your own item" 
            });
        }

        // Check if item is already borrowed or has pending request
        const existingTransaction = await Transaction.findOne({
            itemId: itemId,
            status: { $in: ['pending', 'approved'] }
        });

        if (existingTransaction) {
            return res.status(400).json({ 
                message: "This item already has an active request or is borrowed" 
            });
        }

        // Create new transaction
        const transaction = new Transaction({
            id: uuid(),
            itemId,
            borrowerId,
            lenderId: item.ownerId,
            status: "pending",
            startDate: new Date()
        });

        await transaction.save();
        console.log(`Transaction created successfully: ${transaction.id}`);

        res.status(201).json({ 
            message: "Borrow request sent successfully", 
            transaction 
        });
    } catch (err) {
        console.error('Transaction error:', err);
        res.status(500).json({ 
            message: "Error creating borrow request", 
            error: err.message 
        });
    }
});

// Get All Transactions
app.get("/api/transactions", async (req, res) => {
    try {
        const transactions = await Transaction.find();
        res.status(200).json(transactions);
    } catch (err) {
        console.error("Error fetching transactions:", err);
        res.status(500).json({ message: "Failed to fetch transactions" });
    }
});

// Get Transactions for User
app.get("/api/transactions/user/:userId", async (req, res) => {
    try {
        const { userId } = req.params;
        console.log('Fetching transactions for user:', userId);
        
        // Get all transactions where user is either borrower or lender
        const transactions = await Transaction.find({
            $or: [
                { borrowerId: userId },
                { lenderId: userId }
            ],
            status: { $in: ['pending', 'approved'] }  // Only get active transactions
        });
        console.log('Found transactions:', transactions);

        // Get all item IDs from transactions
        const itemIds = [...new Set(transactions.map(t => t.itemId))];
        console.log('Item IDs:', itemIds);
        
        // Fetch all related items
        const items = await Item.find({ id: { $in: itemIds } });
        console.log('Found items:', items);
        const itemMap = items.reduce((map, item) => {
            map[item.id] = item;
            return map;
        }, {});

        // Get all user IDs (both borrowers and lenders)
        const userIds = [...new Set([
            ...transactions.map(t => t.borrowerId),
            ...transactions.map(t => t.lenderId)
        ])];
        
        // Fetch all related users
        const users = await User.find({ id: { $in: userIds } });
        const userMap = users.reduce((map, user) => {
            map[user.id] = {
                id: user.id,
                name: user.name,
                email: user.email
            };
            return map;
        }, {});

        // Add item and user details to transactions
        const enrichedTransactions = transactions.map(t => {
            console.log('Processing transaction:', t);
            return {
                id: t.id,
                itemId: t.itemId,
                borrowerId: t.borrowerId,
                lenderId: t.lenderId,
                status: t.status,
                item: itemMap[t.itemId],
                borrower: userMap[t.borrowerId],
                lender: userMap[t.lenderId]
            };
        });

        console.log('Sending enriched transactions:', enrichedTransactions);
        res.status(200).json(enrichedTransactions);
    } catch (err) {
        console.error("Error fetching transactions:", err);
        res.status(500).json({ message: "Failed to fetch transactions" });
    }
});

// Update Transaction Status (Approve/Reject)
app.put("/api/transactions/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { status, userId } = req.body;
        console.log('Updating transaction:', id, 'to status:', status);

        const transaction = await Transaction.findOne({ id });
        if (!transaction) {
            return res.status(404).json({ message: "Transaction not found" });
        }

        // Verify the user is the owner of the item
        if (transaction.lenderId !== userId) {
            return res.status(403).json({ message: "Only the item owner can approve/reject requests" });
        }

        if (!['approved', 'rejected'].includes(status)) {
            return res.status(400).json({ message: "Invalid status" });
        }

        transaction.status = status;
        if (status === 'approved') {
            transaction.borrowDate = new Date();
            
            // Update item status
            await Item.findOneAndUpdate(
                { id: transaction.itemId },
                { status: 'borrowed' }
            );
        }

        await transaction.save();
        console.log('Transaction updated successfully');

        res.status(200).json({ 
            message: `Request ${status} successfully`, 
            transaction 
        });
    } catch (err) {
        console.error("Error updating transaction:", err);
        res.status(500).json({ message: "Failed to update request" });
    }
});

// Cancel Borrow Request or Return Item
app.post("/api/transactions/cancel", async (req, res) => {
    try {
        const { itemId, borrowerId } = req.body;
        console.log('Cancel/Return request:', { itemId, borrowerId });
        
        // Find the active transaction
        const transaction = await Transaction.findOne({
            itemId: itemId,
            borrowerId: borrowerId,
            status: { $in: ['pending', 'approved'] }
        });

        if (!transaction) {
            console.log('No active transaction found');
            return res.status(404).json({ message: "No active transaction found" });
        }

        console.log('Found transaction:', transaction);

        // Update transaction status to cancelled
        transaction.status = 'cancelled';
        await transaction.save();
        console.log('Transaction updated to cancelled');

        // Always update item status to available when returning or cancelling
        const item = await Item.findOneAndUpdate(
            { id: itemId },
            { 
                $set: { 
                    status: 'available',
                    lastUpdated: new Date()
                }
            },
            { new: true } // Return the updated document
        );

        if (!item) {
            console.log('Item not found:', itemId);
            return res.status(404).json({ message: "Item not found" });
        }

        // Remove all pending transactions for this item
        await Transaction.updateMany(
            { 
                itemId: itemId,
                status: { $in: ['pending', 'approved'] }
            },
            { 
                $set: { 
                    status: 'cancelled',
                    lastUpdated: new Date()
                }
            }
        );

        console.log('Item updated:', item);

        // Get user details for response
        const borrower = await User.findOne({ id: borrowerId });
        const lender = await User.findOne({ id: transaction.lenderId });

        const response = {
            message: "Item returned successfully and is now available for borrowing",
            transaction: {
                id: transaction.id,
                itemId: transaction.itemId,
                status: 'cancelled',
                borrower: borrower ? {
                    id: borrower.id,
                    name: borrower.name,
                    email: borrower.email
                } : null,
                lender: lender ? {
                    id: lender.id,
                    name: lender.name,
                    email: lender.email
                } : null
            },
            item: {
                id: item.id,
                name: item.name,
                status: 'available'
            }
        };

        console.log('Sending response:', response);
        res.status(200).json(response);
    } catch (err) {
        console.error('Error in cancel/return:', err);
        res.status(500).json({ 
            message: "Error processing request", 
            error: err.message 
        });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Something went wrong!' });
});

// Handle 404
app.use((req, res) => {
    res.status(404).json({ message: 'Route not found' });
});

// Start the server
startServer();