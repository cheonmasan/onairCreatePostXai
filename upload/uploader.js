const puppeteer = require('puppeteer');

async function closePopup(page) {
    let hasError = false;
    try {
        await page.waitForSelector('button.hd_pops_close', { timeout: 10000, visible: true });
        const closeButtons = await page.$$('button.hd_pops_close');
        console.log(`감지된 팝업 버튼 수: ${closeButtons.length}`);
        for (const button of closeButtons) {
            try {
                await button.click();
                await new Promise(resolve => setTimeout(resolve, 500));
                console.log('팝업 닫기 성공');
            } catch (e) {
                console.log(`팝업 닫기 실패: ${e.message}`);
                hasError = true;
            }
        }
    } catch (e) {
        console.log(`팝업 처리 중 오류: ${e.message}`);
        hasError = true;
    }
    if (hasError) {
        console.log(`팝업 닫기 중 오류 발생. 작업은 계속 진행됩니다.`)
    }
}

const uploadPost = async (post, win, db) => {
    let browser;
    let attempts = 0;
    const maxAttempts = 3;
    let timeout = 60000;

    while (attempts < maxAttempts) {
        try {
            browser = await puppeteer.launch({
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
            const page = await browser.newPage();

            const userId = post.userId;
            win.webContents.send('update-status', Buffer.from(`사용자 ID: ${userId}`, 'utf8').toString('utf8'));
            const password = "qwas1477@@";
            await page.goto('https://onairslot.com/', { timeout });
            await closePopup(page, win);
            await page.type('#outlogin_mb_id', userId);
            await page.type('#outlogin_mb_password', password);
            await page.click('#basic_outlogin');
            await page.waitForNavigation({ timeout });
            win.webContents.send('update-status', Buffer.from(`로그인 완료: ${userId}`, 'utf8').toString('utf8'));

            await page.goto('https://onairslot.com/bbs/write.php?bo_table=free', { timeout });
            await page.type('#wr_subject', post.title);
            let frame = await page.waitForFrame(async frame => frame.name() === 'se2_iframe');
            await new Promise((resolve) => setTimeout(resolve, 1000));
            await frame.type('body', post.content);
            await new Promise((resolve) => setTimeout(resolve, 1000));
            await page.click('#btn_submit');
            await page.waitForNavigation({ timeout });
            win.webContents.send('update-status', Buffer.from(`게시글 업로드 완료: ${post.title}`, 'utf8').toString('utf8'));

            await page.goto('https://onairslot.com/bbs/logout.php', { timeout });
            await page.waitForNavigation({ timeout });
            win.webContents.send('update-status', Buffer.from('로그아웃 완료', 'utf8').toString('utf8'));

            await browser.close();
            break;
        } catch (error) {
            attempts++;
            win.webContents.send('update-status', Buffer.from(`게시글 업로드 오류 (시도 ${attempts}/${maxAttempts}): ${error.message} (${error.name})`, 'utf8').toString('utf8'));
            if (error.name === 'TimeoutError') {
                win.webContents.send('update-status', Buffer.from('네트워크 상태 확인 필요: 타임아웃 발생', 'utf8').toString('utf8'));
            }
            if (browser) await browser.close();
            if (attempts === maxAttempts) {
                win.webContents.send('update-status', Buffer.from(`최대 업로드 시도 초과: ${post.title} 업로드 실패`, 'utf8').toString('utf8'));
                throw error;
            }
            timeout += 15000;
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }

    db.run('UPDATE posts SET isUpload = 1 WHERE title = ? AND content = ?', [post.title, post.content], (err) => {
        if (err) win.webContents.send('update-status', Buffer.from(`DB 업데이트 오류: ${err.message}`, 'utf8').toString('utf8'));
        else win.webContents.send('update-status', Buffer.from(`DB 업데이트 완료: ${post.title}`, 'utf8').toString('utf8'));
    });
};

module.exports = { uploadPost, closePopup };