const fs = require('fs');
const path = require('path');
const { urlToHttpOptions } = require('url');

const dir = '/Users/vandijk/Desktop/SW';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));

for (const file of files) {
    const filePath = path.join(dir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Replace <title>santander | ...</title> with <title>mep | ...</title> case-insensitively
    const updated = content.replace(/<title>santander\s*\|\s*/gi, '<title>mep | ');
    
    if (content !== updated) {
        fs.writeFileSync(filePath, updated, 'utf8');
        console.log(`Updated title in ${file}`);
    }
}


