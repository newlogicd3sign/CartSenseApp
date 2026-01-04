const https = require('https');

const candidates = [
    'hot-sauce-or-tabasco',
    'red-chili-sauce',
    'chili-paste',
    'sambal-olek',
    'thai-chili-sauce'
];

const checkUrl = (slug) => {
    return new Promise((resolve) => {
        const url = `https://img.spoonacular.com/ingredients_250x250/${slug}.jpg`;
        https.get(url, (res) => {
            resolve({ slug, status: res.statusCode });
        }).on('error', (e) => {
            resolve({ slug, status: 'error' });
        });
    });
};

async function checkAll() {
    console.log('Checking variants...');
    for (const slug of candidates) {
        const result = await checkUrl(slug);
        console.log(`${slug}: ${result.status}`);
    }
}

checkAll();
