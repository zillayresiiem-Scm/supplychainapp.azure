# Complete Supply Chain Management Application using Microsoft Azure

## Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Azure Services Used](#azure-services-used)
4. [Setup Instructions](#setup-instructions)
5. [Deployment Guide](#deployment-guide)
6. [API Documentation](#api-documentation)
7. [Database Schema](#database-schema)

---

## Overview

This is a **complete, production-ready Supply Chain Management Application** built on Microsoft Azure. It includes:

- **Real-time inventory tracking**
- **Supplier management**
- **Order processing and fulfillment**
- **Shipment tracking**
- **Demand forecasting**
- **Analytics and reporting**
- **Mobile-friendly dashboard**

### Key Features

✅ Real-time inventory updates  
✅ Multi-warehouse support  
✅ Supplier performance tracking  
✅ Order automation  
✅ Shipment tracking with GPS  
✅ Demand forecasting using AI/ML  
✅ Role-based access control (RBAC)  
✅ Comprehensive API  
✅ Mobile responsive UI  
✅ Cloud-native scalability  

---

## Architecture

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                             │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐   │
│  │  Web Dashboard   │  │  Mobile App      │  │  Admin Panel │   │
│  │   (React)        │  │   (React Native) │  │  (React)     │   │
│  └──────────────────┘  └──────────────────┘  └──────────────┘   │
└────────────────────────┬────────────────────────────────────────┘
                         │ HTTPS
┌────────────────────────▼────────────────────────────────────────┐
│              AZURE APP SERVICE (API Gateway)                     │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Express.js REST API (Node.js)                             │ │
│  │  - Authentication & Authorization                          │ │
│  │  - Rate Limiting & Logging                                 │ │
│  │  - Request Validation                                      │ │
│  └────────────────────────────────────────────────────────────┘ │
└────┬──────────┬─────────────┬──────────────┬────────────────────┘
     │          │             │              │
┌────▼──┐  ┌────▼──┐  ┌───────▼──┐  ┌──────▼────┐
│Azure  │  │Azure  │  │Azure     │  │Azure      │
│SQL DB │  │Cache  │  │Cosmos DB │  │Blob       │
│       │  │(Redis)│  │(Analytics)  │Storage    │
└───────┘  └───────┘  └──────────┘  └───────────┘
     │          │             │              │
┌────▼──────────▼─────────────▼──────────────▼──────┐
│        AZURE SYNAPSE (Analytics & ML)              │
│  ┌──────────────────────────────────────────────┐ │
│  │  - Demand Forecasting                        │ │
│  │  - Supplier Analytics                        │ │
│  │  - Inventory Optimization                    │ │
│  └──────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────┐
│     AZURE SERVICE BUS & EVENT GRID                 │
│  - Real-time notifications                         │
│  - Order processing events                         │
│  - Inventory alerts                                │
└────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────┐
│     AZURE KEY VAULT & IDENTITY SERVICES            │
│  - Secure credential storage                       │
│  - API key management                              │
│  - Managed identities                              │
└────────────────────────────────────────────────────┘
```

---

## Azure Services Used

### 1. **Azure App Service**
- Hosts Node.js REST API
- Auto-scaling based on demand
- Built-in CI/CD with GitHub integration

### 2. **Azure SQL Database**
- Primary relational database
- High availability with geo-replication
- Automated backups and disaster recovery

### 3. **Azure Cosmos DB**
- NoSQL database for real-time inventory
- Global distribution capabilities
- High-speed transactions

### 4. **Azure Blob Storage**
- Document and image storage
- CDN integration for fast delivery
- Lifecycle management for cost optimization

### 5. **Azure Cache for Redis**
- Session management
- Real-time data caching
- Performance optimization

### 6. **Azure Synapse Analytics**
- Data warehouse for analytics
- AI/ML capabilities
- Data integration pipelines

### 7. **Azure Service Bus**
- Asynchronous messaging
- Event-driven architecture
- Guaranteed message delivery

### 8. **Azure Key Vault**
- Secure credential storage
- Encryption key management
- API secret management

### 9. **Azure Monitor & Application Insights**
- Application monitoring
- Performance tracking
- Log analytics

### 10. **Azure DevOps**
- CI/CD pipelines
- Code repository
- Release management

---

## Setup Instructions

### Prerequisites

- Azure Subscription (create at https://azure.microsoft.com/free)
- Node.js 16+ (for backend)
- npm or yarn (package manager)
- Git
- Azure CLI installed
- VS Code (recommended)

### Step 1: Create Resource Group

```bash
az group create \
  --name SupplyChainRG \
  --location eastus
```

### Step 2: Create Required Azure Resources

```bash
# Create SQL Database Server
az sql server create \
  --resource-group SupplyChainRG \
  --name supplychaindb \
  --admin-user dbadmin \
  --admin-password YourSecurePassword123!

# Create SQL Database
az sql db create \
  --resource-group SupplyChainRG \
  --server supplychaindb \
  --name SupplyChainDB \
  --service-objective S2

# Create Cosmos DB Account
az cosmosdb create \
  --resource-group SupplyChainRG \
  --name supplychaincosmos \
  --kind GlobalDocumentDB

# Create Storage Account
az storage account create \
  --resource-group SupplyChainRG \
  --name supplychainstore \
  --location eastus \
  --sku Standard_LRS

# Create Redis Cache
az redis create \
  --resource-group SupplyChainRG \
  --name supplychainredis \
  --location eastus \
  --sku basic \
  --vm-size c0

# Create Key Vault
az keyvault create \
  --resource-group SupplyChainRG \
  --name supplychainvault
```

### Step 3: Clone and Setup Backend

```bash
# Clone the repository
git clone https://github.com/yourusername/supply-chain-app.git
cd supply-chain-app

# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Configure environment variables in .env
# Add your Azure connection strings and credentials

# Run database migrations
npm run migrate

# Start development server
npm run dev
```

### Step 4: Deploy to Azure App Service

```bash
# Create App Service Plan
az appservice plan create \
  --name SupplyChainPlan \
  --resource-group SupplyChainRG \
  --sku B2

# Create App Service
az webapp create \
  --resource-group SupplyChainRG \
  --plan SupplyChainPlan \
  --name supply-chain-api \
  --runtime "node|16-lts"

# Deploy code
az webapp up \
  --resource-group SupplyChainRG \
  --name supply-chain-api
```

### Step 5: Setup Frontend

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Build for production
npm run build

# Deploy to Azure Blob Storage (static website)
az storage blob upload-batch \
  --account-name supplychainstore \
  --source ./build \
  --destination '$web'
```

---

## Deployment Guide

### Using Azure DevOps CI/CD

1. **Create Pipeline in Azure DevOps**

```yaml
trigger:
  - main

pool:
  vmImage: 'ubuntu-latest'

stages:
- stage: Build
  jobs:
  - job: BuildBackend
    steps:
    - task: NodeTool@0
      inputs:
        versionSpec: '16.x'
    - script: npm install
      displayName: 'Install dependencies'
    - script: npm run test
      displayName: 'Run tests'
    - script: npm run build
      displayName: 'Build application'

- stage: Deploy
  jobs:
  - deployment: DeployToProduction
    environment: 'Production'
    strategy:
      runOnce:
        deploy:
          steps:
          - task: AzureWebApp@1
            inputs:
              azureSubscription: 'Azure Subscription'
              appType: 'webAppLinux'
              appName: 'supply-chain-api'
              package: '$(Pipeline.Workspace)'
```

2. **Deploy Using Azure Container Registry (ACR)**

```bash
# Create Container Registry
az acr create \
  --resource-group SupplyChainRG \
  --name supplychainacr \
  --sku Basic

# Build and push Docker image
az acr build \
  --registry supplychainacr \
  --image supply-chain-api:latest .

# Deploy to Azure Container Instances
az container create \
  --resource-group SupplyChainRG \
  --name supply-chain-container \
  --image supplychainacr.azurecr.io/supply-chain-api:latest \
  --cpu 2 \
  --memory 4
```

---

## API Documentation

### Base URL
```
https://supply-chain-api.azurewebsites.net/api
```

### Authentication
All API requests require Bearer token in Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

### Core API Endpoints

#### 1. **Authentication**

**POST /auth/login**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

Response:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user123",
    "email": "user@example.com",
    "role": "manager"
  }
}
```

#### 2. **Inventory Management**

**GET /inventory**
Returns all inventory items with pagination

Query Parameters:
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20)
- `warehouse_id`: Filter by warehouse

Response:
```json
{
  "data": [
    {
      "id": "inv123",
      "product_id": "prod456",
      "warehouse_id": "wh789",
      "quantity": 150,
      "reserved": 30,
      "available": 120,
      "reorder_level": 50,
      "last_updated": "2024-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 245
  }
}
```

**POST /inventory**
Create new inventory item

**PUT /inventory/{id}**
Update inventory quantity

**DELETE /inventory/{id}**
Remove inventory item

#### 3. **Orders**

**GET /orders**
Retrieve all orders

Query Parameters:
- `status`: Filter by status (pending, processing, shipped, delivered)
- `customer_id`: Filter by customer
- `date_from`, `date_to`: Date range filter

**POST /orders**
Create new order

Request:
```json
{
  "customer_id": "cust123",
  "items": [
    {
      "product_id": "prod456",
      "quantity": 10,
      "unit_price": 29.99
    }
  ],
  "shipping_address": {
    "street": "123 Main St",
    "city": "New York",
    "state": "NY",
    "zip": "10001"
  }
}
```

**GET /orders/{id}**
Get specific order details

**PUT /orders/{id}/status**
Update order status

Request:
```json
{
  "status": "shipped",
  "tracking_number": "TRACK123456"
}
```

#### 4. **Suppliers**

**GET /suppliers**
List all suppliers

**POST /suppliers**
Create new supplier

**GET /suppliers/{id}/performance**
Get supplier performance metrics

Response:
```json
{
  "supplier_id": "sup123",
  "on_time_delivery_rate": 96.5,
  "quality_score": 4.8,
  "average_lead_time_days": 7,
  "total_orders": 245,
  "rating": 4.7
}
```

#### 5. **Shipments**

**GET /shipments**
List all shipments

**POST /shipments**
Create new shipment

**GET /shipments/{id}/tracking**
Get real-time tracking

Response:
```json
{
  "shipment_id": "ship123",
  "status": "in_transit",
  "current_location": {
    "lat": 40.7128,
    "lng": -74.0060,
    "address": "New York, NY"
  },
  "estimated_delivery": "2024-01-20T18:00:00Z",
  "updates": [
    {
      "timestamp": "2024-01-18T10:30:00Z",
      "status": "picked_up",
      "location": "Distribution Center"
    }
  ]
}
```

#### 6. **Analytics**

**GET /analytics/dashboard**
Get dashboard metrics

Response:
```json
{
  "total_orders": 1245,
  "pending_orders": 45,
  "total_revenue": 125000,
  "inventory_value": 85000,
  "supplier_performance": 4.6,
  "on_time_delivery": 94.2,
  "inventory_turnover": 8.5
}
```

**GET /analytics/demand-forecast**
Get demand forecast for next 30 days

**GET /analytics/supplier-analytics**
Get comprehensive supplier analytics

---

## Database Schema

### Users Table
```sql
CREATE TABLE Users (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    email NVARCHAR(255) UNIQUE NOT NULL,
    password_hash NVARCHAR(255) NOT NULL,
    first_name NVARCHAR(100),
    last_name NVARCHAR(100),
    role NVARCHAR(50), -- admin, manager, staff
    phone NVARCHAR(20),
    is_active BIT DEFAULT 1,
    created_at DATETIME DEFAULT GETDATE(),
    updated_at DATETIME DEFAULT GETDATE()
);
```

### Products Table
```sql
CREATE TABLE Products (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    sku NVARCHAR(50) UNIQUE NOT NULL,
    name NVARCHAR(255) NOT NULL,
    description NVARCHAR(MAX),
    category NVARCHAR(100),
    unit_price DECIMAL(10,2),
    supplier_id UNIQUEIDENTIFIER,
    reorder_level INT,
    lead_time_days INT,
    created_at DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (supplier_id) REFERENCES Suppliers(id)
);
```

### Inventory Table
```sql
CREATE TABLE Inventory (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    product_id UNIQUEIDENTIFIER NOT NULL,
    warehouse_id UNIQUEIDENTIFIER NOT NULL,
    quantity INT,
    reserved INT DEFAULT 0,
    reorder_level INT,
    last_updated DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (product_id) REFERENCES Products(id),
    FOREIGN KEY (warehouse_id) REFERENCES Warehouses(id)
);
```

### Orders Table
```sql
CREATE TABLE Orders (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    order_number NVARCHAR(50) UNIQUE NOT NULL,
    customer_id UNIQUEIDENTIFIER NOT NULL,
    order_date DATETIME DEFAULT GETDATE(),
    status NVARCHAR(50), -- pending, processing, shipped, delivered
    total_amount DECIMAL(12,2),
    shipping_address NVARCHAR(MAX),
    created_at DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (customer_id) REFERENCES Customers(id)
);
```

### OrderItems Table
```sql
CREATE TABLE OrderItems (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    order_id UNIQUEIDENTIFIER NOT NULL,
    product_id UNIQUEIDENTIFIER NOT NULL,
    quantity INT,
    unit_price DECIMAL(10,2),
    FOREIGN KEY (order_id) REFERENCES Orders(id),
    FOREIGN KEY (product_id) REFERENCES Products(id)
);
```

### Suppliers Table
```sql
CREATE TABLE Suppliers (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    name NVARCHAR(255) NOT NULL,
    contact_person NVARCHAR(100),
    email NVARCHAR(255),
    phone NVARCHAR(20),
    address NVARCHAR(255),
    city NVARCHAR(100),
    state NVARCHAR(50),
    country NVARCHAR(100),
    on_time_delivery_rate DECIMAL(5,2),
    quality_score DECIMAL(5,2),
    rating DECIMAL(5,2),
    is_active BIT DEFAULT 1,
    created_at DATETIME DEFAULT GETDATE()
);
```

### Shipments Table
```sql
CREATE TABLE Shipments (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    order_id UNIQUEIDENTIFIER NOT NULL,
    tracking_number NVARCHAR(100) UNIQUE,
    carrier NVARCHAR(100),
    status NVARCHAR(50),
    current_location NVARCHAR(255),
    estimated_delivery DATETIME,
    actual_delivery DATETIME,
    created_at DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (order_id) REFERENCES Orders(id)
);
```

---

## Environment Variables (.env)

```env
# Server
NODE_ENV=production
PORT=8080
API_URL=https://supply-chain-api.azurewebsites.net

# Azure SQL Database
SQL_SERVER=supplychaindb.database.windows.net
SQL_DATABASE=SupplyChainDB
SQL_USER=dbadmin
SQL_PASSWORD=YourSecurePassword123!

# Azure Cosmos DB
COSMOS_ENDPOINT=https://supplychaincosmos.documents.azure.com:443/
COSMOS_KEY=your_cosmos_key_here

# Azure Storage
STORAGE_ACCOUNT_NAME=supplychainstore
STORAGE_ACCOUNT_KEY=your_storage_key_here

# Azure Redis Cache
REDIS_HOST=supplychainredis.redis.cache.windows.net
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password

# Azure Key Vault
KEYVAULT_URL=https://supplychainvault.vault.azure.net/

# JWT Secret
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRY=7d

# Email Service
EMAIL_SERVICE=SendGrid
SENDGRID_API_KEY=your_sendgrid_api_key

# Application Insights
APPINSIGHTS_INSTRUMENTATION_KEY=your_insights_key
```

---

## Monitoring & Logging

### Application Insights Setup

```bash
# Create Application Insights resource
az resource create \
  --resource-group SupplyChainRG \
  --resource-type "microsoft.insights/components" \
  --name supply-chain-insights \
  --properties '{"Application_Type":"web"}'
```

### Key Metrics to Monitor

1. **Application Performance**
   - Response time (target: <500ms)
   - Error rate (target: <1%)
   - Throughput (requests/sec)

2. **Business Metrics**
   - Order processing time
   - Inventory accuracy
   - Supplier performance

3. **Infrastructure**
   - CPU usage
   - Memory consumption
   - Database connections
   - Storage usage

---

## Security Best Practices

✅ **Authentication**: JWT tokens with 7-day expiry  
✅ **Authorization**: Role-based access control (RBAC)  
✅ **Encryption**: TLS 1.2+ for all data in transit  
✅ **Data Protection**: AES-256 encryption for sensitive data  
✅ **Secrets Management**: Azure Key Vault for all credentials  
✅ **Network Security**: Azure Firewall and Network Security Groups  
✅ **API Security**: Rate limiting, input validation, CORS  
✅ **Audit Logging**: All sensitive operations logged  
✅ **Backup & Recovery**: Automated daily backups  

---

## Scaling & Performance

### Auto-Scaling Configuration

```json
{
  "autoscaleSettings": {
    "enabled": true,
    "minInstances": 2,
    "maxInstances": 10,
    "targetCPUPercentage": 70,
    "scaleUpThreshold": 80,
    "scaleDownThreshold": 30
  }
}
```

### Caching Strategy

- **Session Cache**: Redis (15 min TTL)
- **Inventory Cache**: Redis (5 min TTL)
- **Report Cache**: Blob Storage (1 hour TTL)
- **API Response Cache**: CDN (10 min TTL)

### Database Optimization

- Connection pooling: 50 connections
- Query optimization: Index on frequently used columns
- Partitioning: By warehouse and date
- Archive strategy: Move old data to cold storage

---

## Troubleshooting

### Common Issues

1. **Connection Timeout**
   - Check Azure firewall rules
   - Verify connection string
   - Check network connectivity

2. **High Memory Usage**
   - Review cache configuration
   - Check for memory leaks
   - Optimize database queries

3. **Slow API Response**
   - Enable query profiling
   - Check Application Insights
   - Review network latency

4. **Database Lock Issues**
   - Check long-running transactions
   - Review deadlock reports
   - Optimize indexes

---

## Support & Resources

- **Azure Documentation**: https://docs.microsoft.com/azure/
- **Node.js Best Practices**: https://nodejs.org/en/docs/guides/
- **Azure CLI Reference**: https://docs.microsoft.com/cli/azure/
- **Architecture Center**: https://docs.microsoft.com/azure/architecture/

---

## License

This application is provided as-is for educational and commercial use.

---

**Created**: January 2024  
**Version**: 1.0.0  
**Last Updated**: January 2024
