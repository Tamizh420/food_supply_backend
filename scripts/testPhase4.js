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

        const supplierA = await User.create({ name: 'SupA', email: 'supA@test.com', password: pass, role: 'supplier' });
        const supplierB = await User.create({ name: 'SupB', email: 'supB@test.com', password: pass, role: 'supplier' });
        const buyer = await User.create({ name: 'Buyer', email: 'buyer@test.com', password: pass, role: 'buyer' });
        const ngo = await User.create({ name: 'NGO', email: 'ngo@test.com', password: pass, role: 'ngo' });
        const admin = await User.create({ name: 'Admin', email: 'admin@test.com', password: pass, role: 'admin' });

        const getToken = async (email) => (await api.post('/auth/login', { email, password: pass })).data.token;
        const tSupA = await getToken('supA@test.com');
        const tSupB = await getToken('supB@test.com');
        const tBuyer = await getToken('buyer@test.com');
        const tNgo = await getToken('ngo@test.com');
        const tAdmin = await getToken('admin@test.com');

        const authHeader = (t) => ({ headers: { Authorization: `Bearer ${t}` } });
        const createListing = async (t) => (await api.post('/listings', { foodType: 'Test', quantity: '1', cookedAt: new Date(), expiresAt: new Date(Date.now() + 86400000), pricingType: 'free', pickupLocation: { address: 'A', lat: 10, lng: 10 } }, authHeader(t))).data;
        
        let testsPassed = 0;
        let testsFailed = 0;
        const assert = (condition, name) => {
            if (condition) {
                console.log(`[PASS] ${name}`);
                testsPassed++;
            } else {
                console.error(`[FAIL] ${name}`);
                testsFailed++;
            }
        };

        const listingA = await createListing(tSupA);
        let orderRes = await api.post('/orders', { listingId: listingA._id }, authHeader(tBuyer));
        let orderId = orderRes.data._id;

        await api.put(`/orders/${orderId}/status`, { status: 'accepted' }, authHeader(tSupA));
        await api.put(`/orders/${orderId}/status`, { status: 'ready' }, authHeader(tSupA));

        const buyerOrder = (await api.get(`/orders/${orderId}`, authHeader(tBuyer))).data;
        const supAOrder = (await api.get(`/orders/${orderId}`, authHeader(tSupA))).data;
        
        assert(buyerOrder.pickupCode && buyerOrder.pickupCode.length === 6, "Buyer can see their own READY pickup code");
        assert(!supAOrder.pickupCode, "Supplier cannot see the pickup code in API responses");
        
        const validCode = buyerOrder.pickupCode;

        const bypassRes = await api.put(`/orders/${orderId}/status`, { status: 'completed' }, authHeader(tSupA));
        assert(bypassRes.status === 400, "Supplier cannot bypass verification through old status endpoint");

        const verifyBuyerRes = await api.post(`/orders/${orderId}/verify`, { verificationCode: validCode }, authHeader(tBuyer));
        assert(verifyBuyerRes.status === 403, "Buyer cannot call verification endpoint");
        
        const verifyNgoRes = await api.post(`/orders/${orderId}/verify`, { verificationCode: validCode }, authHeader(tNgo));
        assert(verifyNgoRes.status === 403, "NGO cannot call verification endpoint");

        const verifySupBRes = await api.post(`/orders/${orderId}/verify`, { verificationCode: validCode }, authHeader(tSupB));
        assert(verifySupBRes.status === 403, "Supplier cannot verify another supplier's order");

        const verifyAdminRes = await api.post(`/orders/${orderId}/verify`, { verificationCode: validCode }, authHeader(tAdmin));
        assert(verifyAdminRes.status === 403, "Admin cannot use normal verification endpoint");

        const invalidVerifyRes = await api.post(`/orders/${orderId}/verify`, { verificationCode: '000000' }, authHeader(tSupA));
        assert(invalidVerifyRes.status === 400, "Invalid code is rejected");

        await api.post(`/orders/${orderId}/verify`, { verificationCode: '000000' }, authHeader(tSupA));
        await api.post(`/orders/${orderId}/verify`, { verificationCode: '000000' }, authHeader(tSupA));
        await api.post(`/orders/${orderId}/verify`, { verificationCode: '000000' }, authHeader(tSupA));
        await api.post(`/orders/${orderId}/verify`, { verificationCode: '000000' }, authHeader(tSupA));
        
        const rateLimitRes = await api.post(`/orders/${orderId}/verify`, { verificationCode: validCode }, authHeader(tSupA));
        assert(rateLimitRes.status === 429, "Repeated invalid codes are rate-limited");

        await Order.findByIdAndUpdate(orderId, { failedVerificationAttempts: 0 });

        const validVerifyRes = await api.post(`/orders/${orderId}/verify`, { verificationCode: validCode }, authHeader(tSupA));
        assert(validVerifyRes.status === 200 && validVerifyRes.data.status === 'completed', "Supplier can verify valid READY order");
        assert(validVerifyRes.data.pickupVerifiedAt, "Successful verification records pickupVerifiedAt");
        assert(validVerifyRes.data.pickupVerifiedBy === supplierA._id.toString(), "Successful verification records pickupVerifiedBy");
        assert(validVerifyRes.data.verificationMethod === 'code', "Successful verification records verificationMethod");

        const reVerifyRes = await api.post(`/orders/${orderId}/verify`, { verificationCode: validCode }, authHeader(tSupA));
        assert(reVerifyRes.status === 400, "Completed order cannot be verified again");

        const listC = await createListing(tSupA);
        const orderC = (await api.post('/orders', { listingId: listC._id }, authHeader(tBuyer))).data;
        await api.put(`/orders/${orderC._id}/status`, { status: 'cancelled' }, authHeader(tBuyer));
        const cancelVerify = await api.post(`/orders/${orderC._id}/verify`, { verificationCode: '111111' }, authHeader(tSupA));
        assert(cancelVerify.status === 400, "Cancelled order cannot be verified");

        const listR = await createListing(tSupA);
        const orderR = (await api.post('/orders', { listingId: listR._id }, authHeader(tBuyer))).data;
        await api.put(`/orders/${orderR._id}/status`, { status: 'rejected' }, authHeader(tSupA));
        const rejectVerify = await api.post(`/orders/${orderR._id}/verify`, { verificationCode: '111111' }, authHeader(tSupA));
        assert(rejectVerify.status === 400, "Rejected order cannot be verified");

        const listAc = await createListing(tSupA);
        const orderAc = (await api.post('/orders', { listingId: listAc._id }, authHeader(tBuyer))).data;
        await api.put(`/orders/${orderAc._id}/status`, { status: 'accepted' }, authHeader(tSupA));
        const acceptVerify = await api.post(`/orders/${orderAc._id}/verify`, { verificationCode: '111111' }, authHeader(tSupA));
        assert(acceptVerify.status === 400, "Accepted order cannot be verified");


        console.log(`\nResults: ${testsPassed} Passed, ${testsFailed} Failed.`);

        await User.deleteMany({ email: { $in: ['supA@test.com', 'supB@test.com', 'buyer@test.com', 'ngo@test.com', 'admin@test.com'] } });
        await Listing.deleteMany({ _id: { $in: [listingA._id, listC._id, listR._id, listAc._id] }});
        await Order.deleteMany({ listingId: { $in: [listingA._id, listC._id, listR._id, listAc._id] }});
        
    } catch (err) {
        console.error("Test execution failed:", err);
    } finally {
        await mongoose.disconnect();
    }
};

runTests();
