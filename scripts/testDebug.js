import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const api = {
    post: async (url, body, config) => {
        const res = await fetch(`http://localhost:5000/api${url}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...config?.headers },
            body: JSON.stringify(body)
        });
        const data = await res.json().catch(()=>({}));
        return { status: res.status, data };
    }
};

const pass = 'password123';
import User from '../src/models/User.js';

const run = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const tSup = (await api.post('/auth/login', { email: 'sup5@test.com', password: pass })).data.token;
        const tBuyer = (await api.post('/auth/login', { email: 'buyer5@test.com', password: pass })).data.token;
        const authHeader = (t) => ({ headers: { Authorization: `Bearer ${t}` } });
        
        const list = await api.post('/listings', { foodType: 'Test', quantity: '10', cookedAt: new Date(), expiresAt: new Date(Date.now() + 86400000), pricingType: 'free', price: 0, pickupLocation: { address: 'A', lat: 10, lng: 10 } }, authHeader(tSup));
        console.log("List Create:", list.status, list.data);
        
        const orderRes = await api.post('/orders', { listingId: list.data._id, quantity: 2 }, authHeader(tBuyer));
        console.log("Order Create:", orderRes.status, orderRes.data);

        const invQ1 = await api.post('/orders', { listingId: list.data._id, quantity: 'abc' }, authHeader(tBuyer));
        console.log("Invalid Quantity:", invQ1.status, invQ1.data);

    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
}
run();
