// ========================================
// SUPPLY CHAIN DASHBOARD - REACT COMPONENT
// File: src/pages/Dashboard.jsx
// ========================================

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import {
    Package, TrendingUp, AlertCircle, Truck,
    Users, DollarSign, Clock, CheckCircle
} from 'lucide-react';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080/api';

const Dashboard = () => {
    const [dashboardData, setDashboardData] = useState(null);
    const [orders, setOrders] = useState([]);
    const [inventory, setInventory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('overview');

    const token = localStorage.getItem('authToken');

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        try {
            setLoading(true);
            const headers = { Authorization: `Bearer ${token}` };

            // Fetch dashboard metrics
            const dashboardResponse = await axios.get(
                `${API_BASE_URL}/analytics/dashboard`,
                { headers }
            );
            setDashboardData(dashboardResponse.data);

            // Fetch recent orders
            const ordersResponse = await axios.get(
                `${API_BASE_URL}/orders?limit=10`,
                { headers }
            );
            setOrders(ordersResponse.data.data || []);

            // Fetch inventory
            const inventoryResponse = await axios.get(
                `${API_BASE_URL}/inventory?limit=10`,
                { headers }
            );
            setInventory(inventoryResponse.data.data || []);

            setError(null);
        } catch (err) {
            console.error('Error fetching dashboard data:', err);
            setError('Failed to load dashboard data');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-700 flex items-center">
                    <AlertCircle className="mr-2" />
                    {error}
                </p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white shadow">
                <div className="max-w-7xl mx-auto px-4 py-6">
                    <h1 className="text-3xl font-bold text-gray-900">
                        Supply Chain Dashboard
                    </h1>
                    <p className="text-gray-600 mt-2">
                        Real-time inventory and order management
                    </p>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-4 py-8">
                {/* Key Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <MetricCard
                        title="Total Orders"
                        value={dashboardData?.totalOrders || 0}
                        icon={<Package className="text-blue-600" />}
                        color="blue"
                    />
                    <MetricCard
                        title="Pending Orders"
                        value={dashboardData?.pendingOrders || 0}
                        icon={<Clock className="text-orange-600" />}
                        color="orange"
                    />
                    <MetricCard
                        title="Total Revenue"
                        value={`$${(dashboardData?.totalRevenue || 0).toLocaleString()}`}
                        icon={<DollarSign className="text-green-600" />}
                        color="green"
                    />
                    <MetricCard
                        title="Supplier Rating"
                        value={`${(dashboardData?.supplierPerformance || 0).toFixed(1)}/5.0`}
                        icon={<TrendingUp className="text-purple-600" />}
                        color="purple"
                    />
                </div>

                {/* Tabs */}
                <div className="mb-6 flex space-x-4 border-b border-gray-200">
                    {['overview', 'orders', 'inventory'].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-4 py-2 font-medium text-sm capitalize border-b-2 transition-colors ${
                                activeTab === tab
                                    ? 'border-blue-600 text-blue-600'
                                    : 'border-transparent text-gray-600 hover:text-gray-900'
                            }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                {activeTab === 'overview' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-white p-6 rounded-lg shadow">
                            <h3 className="text-lg font-semibold mb-4">Orders Trend</h3>
                            <ResponsiveContainer width="100%" height={300}>
                                <LineChart data={generateOrderTrendData()}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="date" />
                                    <YAxis />
                                    <Tooltip />
                                    <Legend />
                                    <Line type="monotone" dataKey="orders" stroke="#3b82f6" />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="bg-white p-6 rounded-lg shadow">
                            <h3 className="text-lg font-semibold mb-4">Order Status Distribution</h3>
                            <ResponsiveContainer width="100%" height={300}>
                                <PieChart>
                                    <Pie
                                        data={generateOrderStatusData(orders)}
                                        cx="50%"
                                        cy="50%"
                                        labelLine={false}
                                        label={renderCustomLabel}
                                        outerRadius={100}
                                        fill="#8884d8"
                                        dataKey="value"
                                    >
                                        {generateOrderStatusData(orders).map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="bg-white p-6 rounded-lg shadow lg:col-span-2">
                            <h3 className="text-lg font-semibold mb-4">Daily Revenue</h3>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={generateRevenueData()}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="date" />
                                    <YAxis />
                                    <Tooltip />
                                    <Legend />
                                    <Bar dataKey="revenue" fill="#10b981" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}

                {activeTab === 'orders' && (
                    <div className="bg-white rounded-lg shadow overflow-hidden">
                        <div className="p-6 border-b">
                            <h3 className="text-lg font-semibold">Recent Orders</h3>
                        </div>
                        <OrdersTable orders={orders} />
                    </div>
                )}

                {activeTab === 'inventory' && (
                    <div className="bg-white rounded-lg shadow overflow-hidden">
                        <div className="p-6 border-b">
                            <h3 className="text-lg font-semibold">Inventory Status</h3>
                        </div>
                        <InventoryTable inventory={inventory} />
                    </div>
                )}
            </div>
        </div>
    );
};

// ========================================
// HELPER COMPONENTS
// ========================================

const MetricCard = ({ title, value, icon, color }) => {
    const bgColor = {
        blue: 'bg-blue-50',
        orange: 'bg-orange-50',
        green: 'bg-green-50',
        purple: 'bg-purple-50'
    }[color];

    return (
        <div className={`${bgColor} p-6 rounded-lg border border-gray-200`}>
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-gray-600 text-sm font-medium">{title}</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
                </div>
                <div className="text-4xl">{icon}</div>
            </div>
        </div>
    );
};

const OrdersTable = ({ orders }) => {
    const getStatusColor = (status) => {
        const colors = {
            pending: 'bg-yellow-100 text-yellow-800',
            processing: 'bg-blue-100 text-blue-800',
            shipped: 'bg-purple-100 text-purple-800',
            delivered: 'bg-green-100 text-green-800'
        };
        return colors[status] || 'bg-gray-100 text-gray-800';
    };

    return (
        <div className="overflow-x-auto">
            <table className="w-full">
                <thead className="bg-gray-50 border-b">
                    <tr>
                        <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">
                            Order Number
                        </th>
                        <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">
                            Customer
                        </th>
                        <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">
                            Amount
                        </th>
                        <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">
                            Status
                        </th>
                        <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">
                            Date
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {orders.map((order) => (
                        <tr key={order.id} className="border-b hover:bg-gray-50">
                            <td className="px-6 py-4 text-sm font-medium text-gray-900">
                                {order.order_number}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-700">
                                {order.customer_name}
                            </td>
                            <td className="px-6 py-4 text-sm font-medium text-gray-900">
                                ${order.total_amount?.toLocaleString()}
                            </td>
                            <td className="px-6 py-4 text-sm">
                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                                    {order.status}
                                </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-700">
                                {new Date(order.order_date).toLocaleDateString()}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

const InventoryTable = ({ inventory }) => {
    return (
        <div className="overflow-x-auto">
            <table className="w-full">
                <thead className="bg-gray-50 border-b">
                    <tr>
                        <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">
                            Product
                        </th>
                        <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">
                            SKU
                        </th>
                        <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">
                            Quantity
                        </th>
                        <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">
                            Reserved
                        </th>
                        <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">
                            Available
                        </th>
                        <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">
                            Status
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {inventory.map((item) => {
                        const stockStatus = 
                            item.available > item.reorder_level ? 'text-green-600' :
                            item.available > 0 ? 'text-orange-600' : 'text-red-600';
                        
                        return (
                            <tr key={item.id} className="border-b hover:bg-gray-50">
                                <td className="px-6 py-4 text-sm font-medium text-gray-900">
                                    {item.name}
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-700">
                                    {item.sku}
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                                    {item.quantity}
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-700">
                                    {item.reserved}
                                </td>
                                <td className="px-6 py-4 text-sm font-medium text-gray-900">
                                    {item.available}
                                </td>
                                <td className={`px-6 py-4 text-sm font-medium ${stockStatus}`}>
                                    {item.available > item.reorder_level ? 'In Stock' :
                                     item.available > 0 ? 'Low Stock' : 'Out of Stock'}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

// ========================================
// DATA GENERATION FUNCTIONS
// ========================================

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

const generateOrderTrendData = () => {
    const data = [];
    for (let i = 29; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        data.push({
            date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            orders: Math.floor(Math.random() * 50) + 20
        });
    }
    return data;
};

const generateOrderStatusData = (orders) => {
    const statuses = {};
    orders.forEach(order => {
        statuses[order.status] = (statuses[order.status] || 0) + 1;
    });
    
    return Object.entries(statuses).map(([status, count]) => ({
        name: status,
        value: count
    }));
};

const generateRevenueData = () => {
    const data = [];
    for (let i = 29; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        data.push({
            date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            revenue: Math.floor(Math.random() * 10000) + 5000
        });
    }
    return data;
};

const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
        <text
            x={x}
            y={y}
            fill="white"
            textAnchor={x > cx ? 'start' : 'end'}
            dominantBaseline="central"
            className="text-sm font-bold"
        >
            {`${(percent * 100).toFixed(0)}%`}
        </text>
    );
};

export default Dashboard;
