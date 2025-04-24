const { getRandomUserId } = require('../utils/userUtils');
const moment = require('moment-timezone');

const savePostsToDB = async (post, win, db) => {
    const userId = post.userId || getRandomUserId();
    const { title, content, topic } = post;
    const created_at = moment().tz('Asia/Seoul').format('YYYY-MM-DD HH:mm:ss');

    return new Promise((resolve, reject) => {
        db.run(
            'INSERT INTO posts (userId, title, content, topic, created_at, isUpload) VALUES (?, ?, ?, ?, ?, 0)',
            [userId, title, content, topic, created_at],
            function (err) {
                if (err) {
                    win.webContents.send('update-status', Buffer.from(`DB 저장 오류: ${err.message}`, 'utf8').toString('utf8'));
                    reject(err);
                    return;
                }
                const savedPost = { id: this.lastID, userId, title, content, created_at, topic };
                resolve(savedPost);
            }
        );
    });
};

module.exports = { savePostsToDB };