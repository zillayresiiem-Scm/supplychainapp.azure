# SUPPLY CHAIN APPLICATION - QUICK START GUIDE

## 📋 Prerequisites

Before getting started, make sure you have:

- Azure Subscription (https://azure.microsoft.com/free)
- Node.js 16+ installed
- npm or yarn package manager
- Git installed
- Azure CLI installed (https://docs.microsoft.com/cli/azure/install-azure-cli)
- Docker installed (optional, for containerized deployment)
- VS Code or preferred IDE

---

## 🚀 Quick Start (Local Development)

### Option 1: Using Docker Compose (Recommended)

**1. Clone the Repository**
```bash
git clone https://github.com/yourusername/supply-chain-app.git
cd supply-chain-app
```

**2. Start Services with Docker Compose**
```bash
docker-compose up -d
```

This will automatically start:
- SQL Server database
- Redis cache
- Node.js API backend

**3. Access the API**
```
http://localhost:8080/api/health
```

**4. Initialize Database** (Run in separate terminal)
```bash
npm run migrate
npm run seed
```

**5. Start Frontend** (in separate terminal)
```bash
cd frontend
npm install
npm start
```

Access dashboard at: `http://localhost:3000`

### Option 2: Manual Setup

**1. Install Backend Dependencies**
```bash
npm install
```

**2. Configure Environment**
```bash
cp .env.example .env
# Edit .env with your local credentials
```

**3. Start Backend**
```bash
npm run dev
```

**4. Install & Start Frontend**
```bash
cd frontend
npm install
npm start
```

---

## ☁️ Azure Cloud Deployment

### Step 1: Create Azure Resources

**Login to Azure**
```bash
az login
```

**Create Resource Group**
```bash
az group create \
  --name SupplyChainRG \
  --location eastus
```

**Deploy Infrastructure with Bicep**
```bash
az deployment group create \
  --resource-group SupplyChainRG \
  --template-file azure-deploy.bicep \
  --parameters location=eastus environmentName=prod
```

### Step 2: Configure Database

**Create SQL Database Tables**
```bash
# Get SQL Server connection details
SQL_SERVER=$(az sql server show \
  --resource-group SupplyChainRG \
  --name supplychaindb-prod \
  --query fullyQualifiedDomainName -o tsv)

# Run migrations
sqlcmd -S $SQL_SERVER -U dbadmin -P YourPassword -i database/init.sql
```

### Step 3: Deploy Backend

**1. Create Container Registry**
```bash
az acr create \
  --resource-group SupplyChainRG \
  --name supplychainacr \
  --sku Basic
```

**2. Build & Push Docker Image**
```bash
az acr build \
  --registry supplychainacr \
  --image supply-chain-api:v1.0 .
```

**3. Deploy to App Service**
```bash
az webapp create \
  --resource-group SupplyChainRG \
  --plan SupplyChainPlan \
  --name supply-chain-api \
  --deployment-container-image-name supplychainacr.azurecr.io/supply-chain-api:v1.0

# Configure app settings
az webapp config appsettings set \
  --resource-group SupplyChainRG \
  --name supply-chain-api \
  --settings @app-settings.json
```

### Step 4: Deploy Frontend

**Build React Application**
```bash
cd frontend
npm run build
```

**Upload to Azure Blob Storage**
```bash
az storage blob upload-batch \
  --account-name supplychainstore \
  --source ./build \
  --destination '$web'

# Enable static website hosting
az storage account update \
  --name supplychainstore \
  --set "primaryEndpoints.web"
```

---

## 🔐 Security Configuration

### 1. Set Up Key Vault Secrets

```bash
# Store database password
az keyvault secret set \
  --vault-name supplychainvault \
  --name SqlPassword \
  --value "YourSecurePassword123!"

# Store JWT secret
az keyvault secret set \
  --vault-name supplychainvault \
  --name JwtSecret \
  --value "your_super_secret_key"

# Store Redis password
az keyvault secret set \
  --vault-name supplychainvault \
  --name RedisPassword \
  --value "your_redis_password"
```

### 2. Configure Managed Identity

```bash
# Enable managed identity for App Service
az webapp identity assign \
  --resource-group SupplyChainRG \
  --name supply-chain-api

# Grant Key Vault access
PRINCIPAL_ID=$(az webapp identity show \
  --resource-group SupplyChainRG \
  --name supply-chain-api \
  --query principalId -o tsv)

az keyvault set-policy \
  --name supplychainvault \
  --object-id $PRINCIPAL_ID \
  --secret-permissions get list
```

### 3. Configure HTTPS & SSL

```bash
# Create or upload SSL certificate
az webapp config ssl bind \
  --resource-group SupplyChainRG \
  --name supply-chain-api \
  --certificate-name supply-chain-cert \
  --ssl-type SNI
```

---

## 🧪 Testing the Application

### 1. Test API Endpoints

**Health Check**
```bash
curl https://supply-chain-api.azurewebsites.net/api/health
```

**Login**
```bash
curl -X POST https://supply-chain-api.azurewebsites.net/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'
```

**Get Inventory**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://supply-chain-api.azurewebsites.net/api/inventory
```

### 2. Run Automated Tests

```bash
# Unit tests
npm test

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e
```

### 3. Load Testing

```bash
# Using Apache Bench
ab -n 1000 -c 10 https://supply-chain-api.azurewebsites.net/api/health

# Using Artillery
npm install -g artillery
artillery run load-test.yml
```

---

## 📊 Monitoring & Logging

### 1. View Application Insights Metrics

```bash
# Query logs
az monitor app-insights metrics show \
  --app supply-chain-insights \
  --metric requests/count \
  --resource-group SupplyChainRG

# View exceptions
az monitor app-insights query \
  --app supply-chain-insights \
  --analytics-query "exceptions | count"
```

### 2. View Logs

```bash
# Stream live logs
az webapp log tail \
  --resource-group SupplyChainRG \
  --name supply-chain-api

# Download logs
az webapp log download \
  --resource-group SupplyChainRG \
  --name supply-chain-api
```

---

## 🔄 Continuous Deployment

### 1. Setup GitHub Actions

**Create `.github/workflows/deploy.yml`** (already included)

**Configure Secrets in GitHub**
```
Settings → Secrets and variables → Actions
```

Add these secrets:
- `AZURE_CREDENTIALS`: Service Principal credentials
- `AZURE_REGISTRY_USERNAME`: Container registry username
- `AZURE_REGISTRY_PASSWORD`: Container registry password

**Create Service Principal**
```bash
az ad sp create-for-rbac \
  --name "supply-chain-gh-action" \
  --role contributor \
  --scopes /subscriptions/{subscription-id}/resourceGroups/SupplyChainRG
```

### 2. Automatic Deployment

- Push to `main` branch → Deploy to production
- Push to `develop` branch → Deploy to staging
- Pull requests → Run tests

---

## 🛠️ Common Commands

### Database

```bash
# Run migrations
npm run migrate

# Seed sample data
npm run seed

# Backup database
az sql db copy \
  --server supplychaindb \
  --name SupplyChainDB \
  --dest-name SupplyChainDB-backup
```

### Docker

```bash
# Build image locally
docker build -t supply-chain-api:local .

# Run container
docker run -p 8080:8080 supply-chain-api:local

# Check logs
docker logs -f <container-id>
```

### Azure

```bash
# Scale up app service
az appservice plan update \
  --name SupplyChainPlan \
  --resource-group SupplyChainRG \
  --sku P1V2

# Restart app
az webapp restart \
  --name supply-chain-api \
  --resource-group SupplyChainRG

# View resource costs
az costmanagement query \
  --timeframe TheLastMonth \
  --granularity Daily \
  --scope /subscriptions/{subscription-id}
```

---

## 📱 Mobile Access

The application is fully responsive and works on mobile devices:

- iOS: Use Safari or any mobile browser
- Android: Use Chrome or any Android browser
- Native apps: Can be built with React Native sharing business logic

---

## 🐛 Troubleshooting

### Issue: Database connection failed

```bash
# Check SQL Server firewall
az sql server firewall-rule list \
  --server supplychaindb \
  --resource-group SupplyChainRG

# Add current IP
CURRENT_IP=$(curl -s https://api.ipify.org)
az sql server firewall-rule create \
  --server supplychaindb \
  --resource-group SupplyChainRG \
  --name AllowCurrentIP \
  --start-ip-address $CURRENT_IP \
  --end-ip-address $CURRENT_IP
```

### Issue: Redis connection timeout

```bash
# Check Redis status
az redis show \
  --name supplychainredis \
  --resource-group SupplyChainRG

# Update firewall rules
az redis firewall-rules create \
  --name supplychainredis \
  --resource-group SupplyChainRG \
  --name AllowAllAzureServices \
  --start-ip 0.0.0.0 \
  --end-ip 255.255.255.255
```

### Issue: High API latency

```bash
# Check Application Insights
az monitor app-insights metrics show \
  --app supply-chain-insights \
  --metric requests/duration

# Scale up resources
az appservice plan update \
  --name SupplyChainPlan \
  --resource-group SupplyChainRG \
  --number-of-workers 3
```

---

## 📚 Additional Resources

- **Azure Documentation**: https://docs.microsoft.com/azure/
- **Node.js Best Practices**: https://nodejs.org/en/docs/guides/
- **React Documentation**: https://react.dev
- **SQL Server Docs**: https://docs.microsoft.com/sql/
- **Azure CLI Reference**: https://docs.microsoft.com/cli/azure/

---

## 📞 Support

For issues and feature requests:
- GitHub Issues: https://github.com/yourusername/supply-chain-app/issues
- Email: support@supplychainapp.com
- Documentation: https://github.com/yourusername/supply-chain-app/wiki

---

## 📄 License

This project is licensed under the MIT License - see LICENSE file for details.

---

**Happy Coding! 🚀**
