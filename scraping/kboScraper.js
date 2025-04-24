const puppeteer = require('puppeteer');
const moment = require('moment-timezone');

const scrapeKboResults = async (win, today, yesterday) => {
    let browser;
    try {
        win.webContents.send('update-status', Buffer.from('Puppeteer 브라우저 초기화 시작', 'utf8').toString('utf8'));
        browser = await puppeteer.launch({ headless: true });
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });
        win.webContents.send('update-status', Buffer.from('KBO 페이지 접속 시작', 'utf8').toString('utf8'));

        await page.goto('https://search.naver.com/search.naver?where=nexearch&sm=tab_etc&qvt=0&query=2025%20KBO%20%EB%A6%AC%EA%B7%B8', {
            waitUntil: 'networkidle2',
            timeout: 30000
        });
        win.webContents.send('update-status', Buffer.from('KBO 페이지 접속 완료', 'utf8').toString('utf8'));

        const todayFormatted = today.replace(/\./g, '');
        const yesterdayFormatted = yesterday.replace(/\./g, '');

        win.webContents.send('update-status', Buffer.from(`날짜: ${todayFormatted}, 어제: ${yesterdayFormatted}`, 'utf8').toString('utf8'));

        // 오늘 탭 클릭
        const todayTabSelector = `#cssScheduleSubTab_today_${todayFormatted}`;
        try {
            await page.waitForSelector(todayTabSelector, { timeout: 5000 });
            await page.click(todayTabSelector);
            await new Promise(resolve => setTimeout(resolve, 3000)); // 동적 로딩 대기
            win.webContents.send('update-status', Buffer.from(`${todayFormatted} 탭 클릭 완료`, 'utf8').toString('utf8'));
        } catch (error) {
            win.webContents.send('update-status', Buffer.from(`오늘 탭 클릭 실패: ${error.message}`, 'utf8').toString('utf8'));
        }

        // 어제 탭 클릭
        const yesterdayTabSelector = `#cssScheduleSubTab_today_${yesterdayFormatted}`;
        try {
            await page.waitForSelector(yesterdayTabSelector, { timeout: 5000 });
            await page.click(yesterdayTabSelector);
            await new Promise(resolve => setTimeout(resolve, 3000));
            win.webContents.send('update-status', Buffer.from(`${yesterdayFormatted} 탭 클릭 완료`, 'utf8').toString('utf8'));
        } catch (error) {
            win.webContents.send('update-status', Buffer.from(`어제 탭 클릭 실패: ${error.message}`, 'utf8').toString('utf8'));
        }

        // 데이터 파싱
        const kboData = await page.evaluate((todayFormatted, yesterdayFormatted, today, yesterday) => {
            const validTeams = ['두산', '키움', 'KIA', '삼성', '한화', '롯데', 'LG', 'NC', 'KT', 'SSG'];

            const parseGames = (panelId, date) => {
                const games = [];
                const panel = document.querySelector(`#${panelId}`);
                if (!panel) return games;

                const rows = panel.querySelectorAll(`tr.schedule_${date.replace(/\./g, '')}`);
                rows.forEach(row => {
                    const time = row.querySelector('.time')?.textContent.trim() || '';
                    const match = row.querySelector('.score .match');
                    if (!match) return;

                    // 팀 이름 파싱 및 유효 팀명 검증
                    const homeTeamRaw = match.querySelector('.team_rgt')?.textContent.trim() || '';
                    const awayTeamRaw = match.querySelector('.team_lft')?.textContent.trim() || '';
                    const homeTeam = validTeams.find(team => homeTeamRaw.includes(team)) || '미정';
                    const awayTeam = validTeams.find(team => awayTeamRaw.includes(team)) || '미정';

                    // 유효 팀명 확인
                    if (!validTeams.includes(homeTeam) || !validTeams.includes(awayTeam)) {
                        console.log(`잘못된 팀명 감지: ${awayTeam} vs ${homeTeam}`);
                        return;
                    }

                    const scoreText = match.querySelector('.txt_score')?.textContent.trim() || '';
                    const location = row.querySelector('.els')?.textContent.trim() || '';
                    const statusText = row.querySelector('.play_msg')?.textContent.trim() || '';
                    const isPlaying = !!match.querySelector('.txt_score img[src*="ico_play.gif"]');

                    let homeScore = '0';
                    let awayScore = '0';
                    let status = '예정';
                    let isCanceled = false;

                    if (statusText.includes('우천취소')) {
                        status = '취소';
                        isCanceled = true;
                    } else if (scoreText.includes(':')) {
                        const [away, home] = scoreText.split(':').map(s => s.trim());
                        homeScore = home || '0';
                        awayScore = away || '0';
                        status = isPlaying ? '경기중' : (scoreText.includes('VS') ? '예정' : (statusText.includes('종료') ? '종료' : '경기중'));
                    }

                    const pitcherHome = match.querySelector('.team_rgt .long .name')?.textContent.trim() || '미정';
                    const pitcherAway = match.querySelector('.team_lft .long .name')?.textContent.trim() || '미정';

                    games.push({
                        date,
                        gameTime: time,
                        homeTeam,
                        awayTeam,
                        homeScore,
                        awayScore,
                        status,
                        isCanceled,
                        pitcherHome,
                        pitcherAway,
                        location
                    });
                });
                return games;
            };

            const todayGames = parseGames(`scheduleTabPanel_1`, today);
            const yesterdayGames = parseGames(`scheduleTabPanel_0`, yesterday);
            const allGames = [...todayGames, ...yesterdayGames];

            // 팀, 장소, 상태, 시간대 로그
            const teams = [...new Set(allGames.flatMap(game => [game.homeTeam, game.awayTeam]))];
            const locations = [...new Set(allGames.map(game => game.location))];
            const statuses = [...new Set(allGames.map(game => game.status))];
            const timeSlots = [...new Set(allGames.map(game => game.gameTime))];
            console.log('스크랩된 팀:', teams);
            console.log('스크랩된 장소:', locations);
            console.log('스크랩된 상태:', statuses);
            console.log('스크랩된 시간대:', timeSlots);

            return { todayGames, yesterdayGames, allGames };
        }, todayFormatted, yesterdayFormatted, today, yesterday);

        // 디버깅: 파싱된 HTML 일부 로깅
        const debugHtml = await page.evaluate(() => {
            const panel = document.querySelector('#scheduleTabPanel_1');
            return panel ? panel.innerHTML.substring(0, 500) : 'Panel not found';
        });
        win.webContents.send('update-status', Buffer.from(`디버깅 HTML (오늘): ${debugHtml}`, 'utf8').toString('utf8'));

        // 스크랩된 데이터 로그
        const teams = [...new Set(kboData.allGames.flatMap(game => [game.homeTeam, game.awayTeam]))];
        const locations = [...new Set(kboData.allGames.map(game => game.location))];
        const statuses = [...new Set(kboData.allGames.map(game => game.status))];
        const timeSlots = [...new Set(kboData.allGames.map(game => game.gameTime))];
        win.webContents.send('update-status', Buffer.from(`스크랩된 팀: ${JSON.stringify(teams)}`, 'utf8').toString('utf8'));
        win.webContents.send('update-status', Buffer.from(`스크랩된 장소: ${JSON.stringify(locations)}`, 'utf8').toString('utf8'));
        win.webContents.send('update-status', Buffer.from(`스크랩된 상태: ${JSON.stringify(statuses)}`, 'utf8').toString('utf8'));
        win.webContents.send('update-status', Buffer.from(`스크랩된 시간대: ${JSON.stringify(timeSlots)}`, 'utf8').toString('utf8'));

        await browser.close();
        win.webContents.send('update-status', Buffer.from('브라우저 종료 완료', 'utf8').toString('utf8'));

        return kboData;
    } catch (error) {
        if (browser) await browser.close();
        win.webContents.send('update-status', Buffer.from(`스크래핑 오류: ${error.message}, 스택: ${error.stack}`, 'utf8').toString('utf8'));
        throw error;
    }
};

module.exports = { scrapeKboResults };