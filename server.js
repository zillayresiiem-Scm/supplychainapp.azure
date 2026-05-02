// ========================================
// SUPPLY CHAIN API - MAIN SERVER FILE
// File: server.js
// ========================================

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const { sql, ConnectionPool } = require('mssql');
const redis = require('redis');
const { ApplicationInsightsClient } = require('@azure/monitor-opentelemetry');

// Load environment variables
dotenv.config();

const app = express();

// ========================================
// MIDDLEWARE CONFIGURATION
// ========================================

// Security middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Application Insights
const aiClient = new ApplicationInsightsClient({
    connectionString: process.env.APPINSIGHTS_CONNECTION_STRING
});

// Request logging middleware
app.use((req, res, next) => {
    const startTime = Date.now();
    
    res.on('finish', () => {
        const duration = Date.now() - startTime;
        aiClient.trackRequest({
            name: `${req.method} ${req.path}`,
            url: req.url,
            duration: duration,
            resultCode: res.statusCode,
            success: res.statusCode < 400
        });
    });
    
    next();
});

// ========================================
// DATABASE CONFIGURATION
// ========================================

const sqlConfig = {
    server: process.env.SQL_SERVER,
    database: process.env.SQL_DATABASE,
    authentication: {
        type: 'default',
        options: {
            userName: process.env.SQL_USER,
            password: process.env.SQL_PASSWORD
        }
    },
    options: {
        encrypt: true,
        trustServerCertificate: false
    }
};

const pool = new ConnectionPool(sqlConfig);
const poolConnect = pool.connect();

// ========================================
// REDIS CACHE CONFIGURATION
// ========================================

const redisClient = redis.createClient({
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
    password: process.env.REDIS_PASSWORD,
    tls: true
});

redisClient.on('error', (err) => {
    console.error('Redis error:', err);
    aiClient.trackException({ exception: err });
});

redisClient.connect();

// ========================================
// AUTHENTICATION MIDDLEWARE
// ========================================

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }
    
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
};

// ========================================
// RATE LIMITING MIDDLEWARE
// ========================================

const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP'
});

app.use('/api/', limiter);

// ========================================
// AUTHENTICATION ROUTES
// ========================================

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Validate input
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required' });
        }
        
        // Query database
        await poolConnect;
        const request = pool.request();
        request.input('email', sql.NVarChar, email);
        
        const result = await request.query(`
            SELECT id, email, password_hash, first_name, last_name, role 
            FROM Users 
            WHERE email = @email AND is_active = 1
        `);
        
        if (result.recordset.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const user = result.recordset[0];
        
        // Verify password (use bcrypt in production)
        const crypto = require('crypto');
        const hash = crypto.createHash('sha256').update(password).digest('hex');
        
        if (hash !== user.password_hash) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        // Generate JWT token
        const token = jwt.sign(
            { 
                id: user.id, 
                email: user.email, 
                role: user.role 
            },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRY || '7d' }
        );
        
        res.json({
            token,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        aiClient.trackException({ exception: error });
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ========================================
// INVENTORY MANAGEMENT ROUTES
// ========================================

// Get all inventory items
app.get('/api/inventory', authenticateToken, async (req, res) => {
    try {
        const { page = 1, limit = 20, warehouse_id } = req.query;
        const offset = (page - 1) * limit;
        
        // Check cache first
        const cacheKey = `inventory:${warehouse_id || 'all'}:${page}`;
        const cached = await redisClient.get(cacheKey);
        
        if (cached) {
            return res.json(JSON.parse(cached));
        }
        
        await poolConnect;
        const request = pool.request();
        request.input('offset', sql.Int, offset);
        request.input('limit', sql.Int, limit);
        
        let query = `
            SELECT i.id, i.product_id, p.name, p.sku, i.warehouse_id, 
                   i.quantity, i.reserved, (i.quantity - i.reserved) as available,
                   i.reorder_level, i.last_updated
            FROM Inventory i
            JOIN Products p ON i.product_id = p.id
            WHERE 1=1
        `;
        
        if (warehouse_id) {
            query += ` AND i.warehouse_id = @warehouse_id`;
            request.input('warehouse_id', sql.UniqueIdentifier, warehouse_id);
        }
        
        query += ` ORDER BY p.name
                  OFFSET @offset ROWS
                  FETCH NEXT @limit ROWS ONLY`;
        
        const result = await request.query(query);
        
        // Get total count
        const countRequest = pool.request();
        const countQuery = warehouse_id 
            ? `SELECT COUNT(*) as total FROM Inventory WHERE warehouse_id = @warehouse_id`
            : `SELECT COUNT(*) as total FROM Inventory`;
        
        if (warehouse_id) {
            countRequest.input('warehouse_id', sql.UniqueIdentifier, warehouse_id);
        }
        
        const countResult = await countRequest.query(countQuery);
        const total = countResult.recordset[0].total;
        
        const response = {
            data: result.recordset,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: total,
                pages: Math.ceil(total / limit)
            }
        };
        
        // Cache for 5 minutes
        await redisClient.setEx(cacheKey, 300, JSON.stringify(response));
        
        res.json(response);
    } catch (error) {
        console.error('Get inventory error:', error);
        aiClient.trackException({ exception: error });
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get inventory item by ID
app.get('/api/inventory/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        
        await poolConnect;
        const request = pool.request();
        request.input('id', sql.UniqueIdentifier, id);
        
        const result = await request.query(`
            SELECT i.*, p.name, p.sku
            FROM Inventory i
            JOIN Products p ON i.product_id = p.id
            WHERE i.id = @id
        `);
        
        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Inventory item not found' });
        }
        
        res.json(result.recordset[0]);
    } catch (error) {
        console.error('Get inventory item error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create inventory item
app.post('/api/inventory', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin' && req.user.role !== 'manager') {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        
        const { product_id, warehouse_id, quantity, reorder_level } = req.body;
        
        // Validate input
        if (!product_id || !warehouse_id || quantity === undefined) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        const { v4: uuidv4 } = require('uuid');
        const id = uuidv4();
        
        await poolConnect;
        const request = pool.request();
        request.input('id', sql.UniqueIdentifier, id);
        request.input('product_id', sql.UniqueIdentifier, product_id);
        request.input('warehouse_id', sql.UniqueIdentifier, warehouse_id);
        request.input('quantity', sql.Int, quantity);
        request.input('reorder_level', sql.Int, reorder_level || 0);
        
        await request.query(`
            INSERT INTO Inventory (id, product_id, warehouse_id, quantity, reorder_level)
            VALUES (@id, @product_id, @warehouse_id, @quantity, @reorder_level)
        `);
        
        // Invalidate cache
        await redisClient.del(`inventory:${warehouse_id}:*`);
        
        res.status(201).json({ id, message: 'Inventory item created successfully' });
    } catch (error) {
        console.error('Create inventory error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update inventory
app.put('/api/inventory/:id', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin' && req.user.role !== 'manager') {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        
        const { id } = req.params;
        const { quantity, reserved, reorder_level } = req.body;
        
        await poolConnect;
        const request = pool.request();
        request.input('id', sql.UniqueIdentifier, id);
        
        let updateQuery = 'UPDATE Inventory SET ';
        const updateFields = [];
        
        if (quantity !== undefined) {
            updateFields.push('quantity = @quantity');
            request.input('quantity', sql.Int, quantity);
        }
        
        if (reserved !== undefined) {
            updateFields.push('reserved = @reserved');
            request.input('reserved', sql.Int, reserved);
        }
        
        if (reorder_level !== undefined) {
            updateFields.push('reorder_level = @reorder_level');
            request.input('reorder_level', sql.Int, reorder_level);
        }
        
        updateFields.push('last_updated = GETDATE()');
        
        updateQuery += updateFields.join(', ') + ' WHERE id = @id';
        
        const result = await request.query(updateQuery);
        
        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ error: 'Inventory item not found' });
        }
        
        // Invalidate cache
        await redisClient.del(`inventory:*:*`);
        
        res.json({ message: 'Inventory updated successfully' });
    } catch (error) {
        console.error('Update inventory error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ========================================
// ORDER MANAGEMENT ROUTES
// ========================================

// Get all orders
app.get('/api/orders', authenticateToken, async (req, res) => {
    try {
        const { page = 1, limit = 20, status, customer_id } = req.query;
        const offset = (page - 1) * limit;
        
        await poolConnect;
        const request = pool.request();
        request.input('offset', sql.Int, offset);
        request.input('limit', sql.Int, limit);
        
        let query = `
            SELECT o.*, c.name as customer_name
            FROM Orders o
            JOIN Customers c ON o.customer_id = c.id
            WHERE 1=1
        `;
        
        if (status) {
            query += ` AND o.status = @status`;
            request.input('status', sql.NVarChar, status);
        }
        
        if (customer_id) {
            query += ` AND o.customer_id = @customer_id`;
            request.input('customer_id', sql.UniqueIdentifier, customer_id);
        }
        
        query += ` ORDER BY o.order_date DESC
                  OFFSET @offset ROWS
                  FETCH NEXT @limit ROWS ONLY`;
        
        const result = await request.query(query);
        
        res.json({
            data: result.recordset,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit)
            }
        });
    } catch (error) {
        console.error('Get orders error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create new order
app.post('/api/orders', authenticateToken, async (req, res) => {
    try {
        const { customer_id, items, shipping_address } = req.body;
        
        if (!customer_id || !items || items.length === 0) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        const { v4: uuidv4 } = require('uuid');
        const orderId = uuidv4();
        const orderNumber = `ORD-${Date.now()}`;
        
        // Calculate total
        const totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
        
        await poolConnect;
        const request = pool.request();
        
        request.input('id', sql.UniqueIdentifier, orderId);
        request.input('order_number', sql.NVarChar, orderNumber);
        request.input('customer_id', sql.UniqueIdentifier, customer_id);
        request.input('status', sql.NVarChar, 'pending');
        request.input('total_amount', sql.Decimal(12, 2), totalAmount);
        request.input('shipping_address', sql.NVarChar, JSON.stringify(shipping_address));
        
        // Insert order
        await request.query(`
            INSERT INTO Orders (id, order_number, customer_id, status, total_amount, shipping_address)
            VALUES (@id, @order_number, @customer_id, @status, @total_amount, @shipping_address)
        `);
        
        // Insert order items
        for (const item of items) {
            const itemId = uuidv4();
            const itemRequest = pool.request();
            
            itemRequest.input('id', sql.UniqueIdentifier, itemId);
            itemRequest.input('order_id', sql.UniqueIdentifier, orderId);
            itemRequest.input('product_id', sql.UniqueIdentifier, item.product_id);
            itemRequest.input('quantity', sql.Int, item.quantity);
            itemRequest.input('unit_price', sql.Decimal(10, 2), item.unit_price);
            
            await itemRequest.query(`
                INSERT INTO OrderItems (id, order_id, product_id, quantity, unit_price)
                VALUES (@id, @order_id, @product_id, @quantity, @unit_price)
            `);
        }
        
        res.status(201).json({
            id: orderId,
            order_number: orderNumber,
            message: 'Order created successfully'
        });
    } catch (error) {
        console.error('Create order error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update order status
app.put('/api/orders/:id/status', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { status, tracking_number } = req.body;
        
        if (!status) {
            return res.status(400).json({ error: 'Status required' });
        }
        
        await poolConnect;
        const request = pool.request();
        request.input('id', sql.UniqueIdentifier, id);
        request.input('status', sql.NVarChar, status);
        
        const result = await request.query(`
            UPDATE Orders
            SET status = @status
            WHERE id = @id
        `);
        
        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }
        
        // If shipped, create shipment record
        if (status === 'shipped' && tracking_number) {
            const shipmentId = require('uuid').v4();
            const shipmentRequest = pool.request();
            
            shipmentRequest.input('id', sql.UniqueIdentifier, shipmentId);
            shipmentRequest.input('order_id', sql.UniqueIdentifier, id);
            shipmentRequest.input('tracking_number', sql.NVarChar, tracking_number);
            shipmentRequest.input('status', sql.NVarChar, 'in_transit');
            
            await shipmentRequest.query(`
                INSERT INTO Shipments (id, order_id, tracking_number, status)
                VALUES (@id, @order_id, @tracking_number, @status)
            `);
        }
        
        res.json({ message: 'Order status updated successfully' });
    } catch (error) {
        console.error('Update order status error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ========================================
// SUPPLIER MANAGEMENT ROUTES
// ========================================

// Get all suppliers
app.get('/api/suppliers', authenticateToken, async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;
        
        await poolConnect;
        const request = pool.request();
        request.input('offset', sql.Int, offset);
        request.input('limit', sql.Int, limit);
        
        const result = await request.query(`
            SELECT * FROM Suppliers
            WHERE is_active = 1
            ORDER BY name
            OFFSET @offset ROWS
            FETCH NEXT @limit ROWS ONLY
        `);
        
        res.json({
            data: result.recordset,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit)
            }
        });
    } catch (error) {
        console.error('Get suppliers error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get supplier performance
app.get('/api/suppliers/:id/performance', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        
        await poolConnect;
        const request = pool.request();
        request.input('supplier_id', sql.UniqueIdentifier, id);
        
        const result = await request.query(`
            SELECT 
                on_time_delivery_rate,
                quality_score,
                rating,
                (SELECT COUNT(*) FROM Orders WHERE supplier_id = @supplier_id) as total_orders
            FROM Suppliers
            WHERE id = @supplier_id
        `);
        
        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Supplier not found' });
        }
        
        res.json(result.recordset[0]);
    } catch (error) {
        console.error('Get supplier performance error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ========================================
// ANALYTICS ROUTES
// ========================================

// Get dashboard metrics
app.get('/api/analytics/dashboard', authenticateToken, async (req, res) => {
    try {
        await poolConnect;
        const request = pool.request();
        
        const queries = `
            SELECT 
                (SELECT COUNT(*) FROM Orders) as total_orders,
                (SELECT COUNT(*) FROM Orders WHERE status = 'pending') as pending_orders,
                (SELECT SUM(total_amount) FROM Orders) as total_revenue,
                (SELECT AVG(rating) FROM Suppliers WHERE is_active = 1) as supplier_performance
        `;
        
        const result = await request.query(queries);
        
        res.json({
            totalOrders: result.recordset[0].total_orders || 0,
            pendingOrders: result.recordset[0].pending_orders || 0,
            totalRevenue: result.recordset[0].total_revenue || 0,
            supplierPerformance: result.recordset[0].supplier_performance || 0
        });
    } catch (error) {
        console.error('Get analytics error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ========================================
// HEALTH CHECK
// ========================================

app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date(),
        environment: process.env.NODE_ENV
    });
});

// ========================================
// ERROR HANDLING
// ========================================

app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    aiClient.trackException({ exception: err });
    
    res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// ========================================
// SERVER STARTUP
// ========================================

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
    console.log(`Supply Chain API running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV}`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('Shutting down...');
    await pool.close();
    redisClient.disconnect();
    process.exit(0);
});

module.exports = app;
