import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

import User from '../src/models/User.js';
import Listing from '../src/models/Listing.js';
import Order from '../src/models/Order.js';

const api = {
    get: async (url, config) => {
        const res = await fetch(`http://localhost:5000/api${url}`, { headers: config?.headers });
        const data = await res.json().catch(()=>({}));
        return { status: res.status, data };
    },
    post: async (url, body, config) => {
        const res = await fetch(`http://localhost:5000/api${url}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...config?.headers },
            body: JSON.stringify(body)
        });
        const data = await res.json().catch(()=>({}));
        return { status: res.status, data };
    },
    put: async (url, body, config) => {
        const res = await fetch(`http://localhost:5000/api${url}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', ...config?.headers },
            body: JSON.stringify(body)
        });
        const data = await res.json().catch(()=>({}));
        return { status: res.status, data };
    }
};

const pass = 'password123';

const runTests = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);

        const supplier = await User.create({ name: 'Sup', email: 'sup5@test.com', password: pass, role: 'supplier' });
        const buyer = await User.create({ name: 'Buyer', email: 'buyer5@test.com', password: pass, role: 'buyer' });

        const getToken = async (email) => (await api.post('/auth/login', { email, password: pass })).data.token;
        const tSup = await getToken('sup5@test.com');
        const tBuyer = await getToken('buyer5@test.com');

        const authHeader = (t) => ({ headers: { Authorization: `Bearer ${t}` } });
        
        const createListing = async (t, pricingType, price) => {
            return (await api.post('/listings', { foodType: 'Test', quantity: '10', cookedAt: new Date(), expiresAt: new Date(Date.now() + 86400000), pricingType, price, pickupLocation: { address: 'A', lat: 10, lng: 10 } }, authHeader(t))).data;
        };

        let testsPassed = 0;
        let testsFailed = 0;
        const assert = (condition, name, debugInfo) => {
            if (condition) {
                console.log(`[PASS] ${name}`);
                testsPassed++;
            } else {
                console.error(`[FAIL] ${name} | Debug: ${JSON.stringify(debugInfo)}`);
                testsFailed++;
            }
        };

        // 1. Free listing order
        const freeListing = await createListing(tSup, 'free', 0);
        const freeOrderRes = await api.post('/orders', { listingId: freeListing._id, quantity: 2 }, authHeader(tBuyer));
        assert(freeOrderRes.status === 201 && freeOrderRes.data.paymentStatus === 'not_applicable' && freeOrderRes.data.totalAmount === 0, "Free listing order sets not_applicable and 0 total", freeOrderRes);

        // 2. Paid listing order
        const paidListing = await createListing(tSup, 'paid', 50);
        const paidOrderRes = await api.post('/orders', { listingId: paidListing._id, quantity: 3 }, authHeader(tBuyer));
        assert(paidOrderRes.status === 201 && paidOrderRes.data.paymentStatus === 'pending' && paidOrderRes.data.totalAmount === 150, "Paid listing order sets pending and calculates total correctly", paidOrderRes);

        // 3. Price snapshot & Supplier changes listing price
        const snapListing = await createListing(tSup, 'paid', 100);
        const snapOrderRes = await api.post('/orders', { listingId: snapListing._id, quantity: 2 }, authHeader(tBuyer));
        const snapOrder = snapOrderRes.data;
        assert(snapOrder.priceAtOrder === 100 && snapOrder.totalAmount === 200, "Price snapshot stored correctly on order creation", snapOrderRes);
        
        if (snapOrder._id) {
            await Listing.findByIdAndUpdate(snapListing._id, { price: 200 });
            const snapOrderFetched = (await api.get(`/orders/${snapOrder._id}`, authHeader(tBuyer))).data;
            assert(snapOrderFetched.priceAtOrder === 100 && snapOrderFetched.totalAmount === 200, "Supplier changes listing price after order creation do not affect existing order amount", snapOrderFetched);

            const modRes = await api.put(`/orders/${snapOrder._id}/status`, { status: 'cancelled', totalAmount: 10, paymentStatus: 'paid' }, authHeader(tBuyer));
            const checkMod = await Order.findById(snapOrder._id);
            assert(checkMod.status === 'cancelled' && checkMod.totalAmount === 200 && checkMod.paymentStatus === 'pending', "Client attempts to modify paymentStatus or totalAmount are ignored", checkMod);
        }

        // 5. Invalid quantity
        const invList = await createListing(tSup, 'paid', 10);
        const invQ1 = await api.post('/orders', { listingId: invList._id, quantity: 'abc' }, authHeader(tBuyer));
        assert(invQ1.status === 400, "Invalid quantity (string) is rejected", invQ1);

        // 6. Zero/negative quantity
        const invQ2 = await api.post('/orders', { listingId: invList._id, quantity: 0 }, authHeader(tBuyer));
        assert(invQ2.status === 400, "Zero quantity is rejected", invQ2);
        const invQ3 = await api.post('/orders', { listingId: invList._id, quantity: -5 }, authHeader(tBuyer));
        assert(invQ3.status === 400, "Negative quantity is rejected", invQ3);

        // 7. Paid listing without valid price
        const zeroPriceListing = await createListing(tSup, 'paid', 0);
        const zOrder = await api.post('/orders', { listingId: zeroPriceListing._id, quantity: 2 }, authHeader(tBuyer));
        assert(zOrder.status === 201 && zOrder.data.totalAmount === 0 && zOrder.data.paymentStatus === 'pending', "Paid listing with 0 price calculates 0 total and pending", zOrder);


        console.log(`\nResults: ${testsPassed} Passed, ${testsFailed} Failed.`);

        await User.deleteMany({ email: { $in: ['sup5@test.com', 'buyer5@test.com'] } });
        await Listing.deleteMany({ supplierId: supplier._id });
        await Order.deleteMany({ buyerId: buyer._id });
        
    } catch (err) {
        console.error("Test execution failed:", err);
    } finally {
        await mongoose.disconnect();
    }
};

runTests();
