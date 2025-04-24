const puppeteer = require('puppeteer');

const scrapeWeatherResults = async (win, today, yesterday) => {
    win.webContents.send('update-status', Buffer.from('네이버 날씨 페이지 스크래핑 시작', 'utf8').toString('utf8'));
    let browser;
    try {
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        await page.setCacheEnabled(false);

        await page.goto('https://search.naver.com/search.naver?sm=tab_hty.top&where=nexearch&ssc=tab.nx.all&query=%EB%82%A0%EC%94%A8', { timeout: 60000 });
        win.webContents.send('update-status', Buffer.from('네이버 날씨 페이지 접속 완료', 'utf8').toString('utf8'));

        const curruntDayFormatted = today.replace(/[^0-9]/g, '');
        win.webContents.send('update-status', Buffer.from(`날짜: ${curruntDayFormatted}`, 'utf8').toString('utf8'));

        // 현재 날씨 데이터 스크래핑
        try {
            await page.waitForSelector('.lcl_lst .lcl_a', { timeout: 30000 });
            win.webContents.send('update-status', Buffer.from('날씨 데이터 로드 완료', 'utf8').toString('utf8'));
        } catch (error) {
            win.webContents.send('update-status', Buffer.from(`날씨 데이터 로드 실패: ${error.message}`, 'utf8').toString('utf8'));
            throw new Error(`날씨 데이터 로드 실패: ${error.message}`);
        }

        // 미세먼지 데이터 로드 대기
        try {
            await page.waitForSelector('.air_info em.state', { timeout: 10000 });
            win.webContents.send('update-status', Buffer.from('미세먼지 데이터 로드 완료', 'utf8').toString('utf8'));
        } catch (error) {
            win.webContents.send('update-status', Buffer.from(`미세먼지 데이터 로드 실패: ${error.message}`, 'utf8').toString('utf8'));
        }

        const weatherData = await page.evaluate(() => {
            const current = [];
            const airQuality = {};
            const seenCities = new Set();

            const targetCities = [
                '서울', '춘천', '강릉', '울릉/독도', '포항', '울산', '부산', '여수', '제주',
                '광주', '목포', '전주', '대전', '대구', '안동', '청주', '수원', '인천'
            ];

            const currentElements = document.querySelectorAll('.lcl_lst .lcl_a');
            if (!currentElements || currentElements.length === 0) {
                return { current: [], airQuality };
            }

            currentElements.forEach(element => {
                const city = element.querySelector('.lcl_name')?.innerText || '';
                const temperature = element.querySelector('._temperature')?.innerText || '0';
                const condition = element.querySelector('.ico_status2')?.innerText || '';
                if (city && temperature && condition && targetCities.includes(city) && !seenCities.has(city)) {
                    seenCities.add(city);
                    current.push({ city, temperature: parseFloat(temperature), condition });
                }
            });

            const fineDustElement = document.querySelector('.air_info:nth-child(1) em.state');
            const ultraFineDustElement = document.querySelector('.air_info:nth-child(2) em.state');
            airQuality.fineDust = fineDustElement?.innerText || '정보 없음';
            airQuality.ultraFineDust = ultraFineDustElement?.innerText || '정보 없음';

            return { current, airQuality };
        }) || { current: [], airQuality: { fineDust: '정보 없음', ultraFineDust: '정보 없음' } };

        win.webContents.send('update-status', Buffer.from(`현재 날씨 데이터 (${curruntDayFormatted}):`, 'utf8').toString('utf8'));
        win.webContents.send('update-status', Buffer.from(`필터링된 도시 목록: ${weatherData.current.map(d => d.city).join(', ')}`, 'utf8').toString('utf8'));
        win.webContents.send('update-status', Buffer.from(`미세먼지 데이터: ${JSON.stringify(weatherData.airQuality)}`, 'utf8').toString('utf8'));

        if (!weatherData || !weatherData.current) {
            win.webContents.send('update-status', Buffer.from('스크래핑 데이터가 없음: weatherData 또는 weatherData.current가 정의되지 않음', 'utf8').toString('utf8'));
            throw new Error('스크래핑 데이터가 없음: weatherData 또는 weatherData.current가 정의되지 않음');
        }

        win.webContents.send('update-status', Buffer.from(`스크래핑 완료: ${weatherData.current.length}개 도시 데이터 추출`, 'utf8').toString('utf8'));

        if (weatherData.current.length === 0) {
            throw new Error('지정한 도시의 날씨 데이터를 찾을 수 없습니다.');
        }

        return weatherData;
    } catch (error) {
        win.webContents.send('update-status', Buffer.from(`스크래핑 또는 API 오류: ${error.message}`, 'utf8').toString('utf8'));
        throw error;
    } finally {
        if (browser) {
            await browser.close();
            win.webContents.send('update-status', Buffer.from('브라우저 종료 완료', 'utf8').toString('utf8'));
        }
    }
};

module.exports = { scrapeWeatherResults };