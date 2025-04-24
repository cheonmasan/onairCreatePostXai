const getRandomUserId = () => {
    const rand = Math.random();
    if (rand < 0.4) return `sg${String(Math.floor(Math.random() * 20) + 1).padStart(2, '0')}`;
    return `sg${String(Math.floor(Math.random() * 80) + 21).padStart(2, '0')}`;
};

module.exports = { getRandomUserId };