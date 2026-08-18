import crypto from 'crypto';

const secret = 'dummy_key_secret';
const webhookPayload = JSON.stringify({
    event: 'payment.captured',
    payload: { payment: { entity: { id: 'pay_WEBHOOK', order_id: 'order_TEST_HOOK' } } }
});
const webhookSig = crypto.createHmac('sha256', secret).update(webhookPayload).digest('hex');

const go = async () => {
    const res = await fetch(`http://localhost:5000/api/payments/webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': webhookSig },
        body: webhookPayload
    });
    console.log(res.status, await res.text());
}
go();
