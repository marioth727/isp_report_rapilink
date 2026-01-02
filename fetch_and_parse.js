
import https from 'https';
import fs from 'fs';

const url = 'https://wisphub-media.s3.us-east-1.amazonaws.com/documentos/postman/WispHub+API.postman_collection.json';
const file = fs.createWriteStream("wisphub.json");

https.get(url, function (response) {
    response.pipe(file);
    file.on('finish', function () {
        file.close(() => {
            console.log("Download complete.");
            parse();
        });
    });
});

function parse() {
    try {
        const raw = fs.readFileSync('wisphub.json', 'utf8');
        const data = JSON.parse(raw);

        function search(items) {
            items.forEach(item => {
                if (item.item) {
                    search(item.item);
                }
                const name = item.name ? item.name.toLowerCase() : '';
                const url = item.request && item.request.url ? (typeof item.request.url === 'string' ? item.request.url : item.request.url.raw) : '';

                if (name.includes('ticket') || (url && url.includes('ticket'))) {
                    console.log('Action Name:', item.name);
                    if (item.request) {
                        console.log('Method:', item.request.method);
                        console.log('URL:', url);
                        if (item.request.body) {
                            console.log('Body:', JSON.stringify(item.request.body, null, 2));
                        }
                    }
                    console.log('-------------------');
                }
            });
        }

        if (data.item) search(data.item);
    } catch (e) {
        console.error("Parse Error:", e);
    }
}
