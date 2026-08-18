import http from 'http';

const fetchUrl = (url) => {
    return new Promise((resolve) => {
        http.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ status: res.statusCode, data }));
        }).on('error', (err) => resolve({ status: 500, data: err.message }));
    });
};

const tests = [
    { name: "latitude 90 -> accepted", url: "http://localhost:5000/api/listings/nearby?latitude=90&longitude=10&radius=10", expectedStatus: 200 },
    { name: "latitude -90 -> accepted", url: "http://localhost:5000/api/listings/nearby?latitude=-90&longitude=10&radius=10", expectedStatus: 200 },
    { name: "latitude 91 -> rejected", url: "http://localhost:5000/api/listings/nearby?latitude=91&longitude=10&radius=10", expectedStatus: 400 },
    { name: "latitude -91 -> rejected", url: "http://localhost:5000/api/listings/nearby?latitude=-91&longitude=10&radius=10", expectedStatus: 400 },
    { name: "longitude 180 -> accepted", url: "http://localhost:5000/api/listings/nearby?latitude=10&longitude=180&radius=10", expectedStatus: 200 },
    { name: "longitude -180 -> accepted", url: "http://localhost:5000/api/listings/nearby?latitude=10&longitude=-180&radius=10", expectedStatus: 200 },
    { name: "longitude 181 -> rejected", url: "http://localhost:5000/api/listings/nearby?latitude=10&longitude=181&radius=10", expectedStatus: 400 },
    { name: "longitude -181 -> rejected", url: "http://localhost:5000/api/listings/nearby?latitude=10&longitude=-181&radius=10", expectedStatus: 400 },
    { name: "malformed coordinates -> rejected", url: "http://localhost:5000/api/listings/nearby?latitude=abc&longitude=def", expectedStatus: 400 },
    { name: "valid nearby query -> 200", url: "http://localhost:5000/api/listings/nearby?latitude=11.6&longitude=78.1&radius=10", expectedStatus: 200 },
];

async function runTests() {
    for (const test of tests) {
        const res = await fetchUrl(test.url);
        const passed = res.status === test.expectedStatus;
        console.log(`[${passed ? 'PASS' : 'FAIL'}] ${test.name} - Got: ${res.status}`);
    }
}

runTests();
