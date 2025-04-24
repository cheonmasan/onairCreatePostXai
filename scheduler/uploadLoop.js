const getRandomInterval = () => {
    return Math.floor(Math.random() * (60000 - 30000 + 1)) + 30000;
};

let uploadTimeout;

const startUploadLoop = (win, fetchPostsFromXAI, savePostsToDB, uploadPost, db) => {
    win.webContents.send('update-status', Buffer.from('업로드 루프 시작', 'utf8').toString('utf8'));

    const uploadNext = async () => {
        let attempts = 0;
        const maxAttempts = 3;

        while (attempts < maxAttempts) {
            try {
                win.webContents.send('update-status', Buffer.from(`게시글 생성 시도 ${attempts + 1}/${maxAttempts}`, 'utf8').toString('utf8'));
                const post = await fetchPostsFromXAI(win);
                let savedPost;

                await db.serialize(async () => {
                    try {
                        savedPost = await savePostsToDB(post, win, db);
                        console.log('savedPost', savedPost);
                        if (!savedPost) {
                            throw new Error('savedPost is undefined');
                        }
                        win.webContents.send('update-status', Buffer.from(`DB 저장 완료: ${JSON.stringify(savedPost)}`, 'utf8').toString('utf8'));
                    } catch (error) {
                        win.webContents.send('update-status', Buffer.from(`DB 저장 오류: ${error.message}`, 'utf8').toString('utf8'));
                        throw error;
                    }
                });

                // 업로드 주석 처리 유지
                // await uploadPost(savedPost, win, db);
                break;
            } catch (error) {
                attempts++;
                win.webContents.send('update-status', Buffer.from(`업로드 실패 (시도 ${attempts}/${maxAttempts}): ${error.message}`, 'utf8').toString('utf8'));
                if (attempts === maxAttempts) {
                    win.webContents.send('update-status', Buffer.from('최대 시도 초과, 루프 재시도 준비', 'utf8').toString('utf8'));
                }
            }
        }

        const interval = attempts < maxAttempts ? getRandomInterval() : 60000;
        win.webContents.send('update-status', Buffer.from(`다음 루프 시작 (${interval/1000}초 후)`, 'utf8').toString('utf8'));
        uploadTimeout = setTimeout(uploadNext, interval);
    };

    uploadNext();
};

const stopUploadLoop = (win) => {
    if (uploadTimeout) {
        clearTimeout(uploadTimeout);
        win.webContents.send('update-status', Buffer.from('업로드 루프 중단', 'utf8').toString('utf8'));
    }
};

module.exports = { startUploadLoop, stopUploadLoop };