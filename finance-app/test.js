const fs = require('fs');
const db = JSON.parse(fs.readFileSync('database.json', 'utf8'));

let budgetState = {
    totalLimit: 4000000,
    categories: [
        { name: '주거비', spent: 0, limit: 1500000 },
        { name: '식비', spent: 0, limit: 500000 },
        { name: '외식', spent: 0, limit: 300000 },
        { name: '교통비', spent: 0, limit: 300000 }
    ]
};

if (db.budgetState) {
    if (db.budgetState.categories && db.budgetState.categories.length > 0) {
        const mergedCategories = [...budgetState.categories];
        db.budgetState.categories.forEach(incomingCat => {
            const existingIdx = mergedCategories.findIndex(c => c.name === incomingCat.name);
            if (existingIdx !== -1) {
                mergedCategories[existingIdx] = incomingCat;
            } else {
                mergedCategories.push(incomingCat);
            }
        });
        budgetState.categories = mergedCategories;
    }
}
console.log(budgetState.categories.length);
