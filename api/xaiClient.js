const axios = require('axios');
const moment = require('moment-timezone');
const sqlite3 = require('sqlite3').verbose();
const { getRandomUserId } = require('../utils/userUtils');
require('dotenv').config();

// 유사도 계산 함수 (주제별 공통 단어 제외)
const calculateSimilarity = (str1, str2, topic) => {
    const commonWordsByTopic = {
        '주제: 야구': ['선발', '18:30', '14:00', '16:00', '경기', '시작', '오늘', '기대', '화이팅'],
        '주제: 룰렛 이벤트': ['포인트', '노려', '대박', '돌려', '당첨'],
        '주제: 유튜브': ['마초', '초코', '방송', '라이브', '게임'],
        '주제: 날씨': ['날씨', '오늘', '맑음', '흐림', '온도'],
        '주제: 야구와 날씨 조합': ['선발', '18:30', '14:00', '16:00', '경기', '날씨', '맑음', '흐림', '기대']
    };
    const commonWords = commonWordsByTopic[topic] || [];
    const words1 = str1.split(/\s+/).filter(word => !commonWords.includes(word) && word);
    const words2 = str2.split(/\s+/).filter(word => !commonWords.includes(word) && word);
    const intersection = words1.filter(word => words2.includes(word));
    return intersection.length / Math.max(words1.length, words2.length, 1);
};

const promptModules = {
    '주제: 야구': require('./kboPrompt'),
//     '주제: 날씨': require('./weatherPrompt'),
//     '주제: 야구와 날씨 조합': require('./kboWeatherPrompt'),
//     '주제: 룰렛 이벤트': require('./roulettePrompt'),
//     '주제: 활동왕 찾기': require('./activeKingPrompt'),
//     '주제: 유튜브': require('./youtubePrompt')
};

const generatePostSelect = () => {
    const themes = Object.keys(promptModules);
    return themes[Math.floor(Math.random() * themes.length)];
};

const checkDuplicatePost = async (db, title, content, topic) => {
    return new Promise((resolve, reject) => {
        db.all(
            'SELECT title, content FROM posts WHERE topic = ? AND created_at >= datetime("now", "-3 minutes")',
            [topic],
            (err, rows) => {
                if (err) reject(err);
                else {
                    const isDuplicate = rows.some(row => 
                        calculateSimilarity(title, row.title, topic) > 0.5 || 
                        calculateSimilarity(content, row.content, topic) > 0.5
                    );
                    resolve(isDuplicate);
                }
            }
        );
    });
};

const fetchPostsFromXAI = async (win, scrapeKboResults, scrapeWeatherResults) => {
    if (!win || !win.webContents) throw new Error('Window is not initialized');
    win.webContents.send('update-status', Buffer.from('게시글 생성 시작', 'utf8').toString('utf8'));

    let prompt;
    let topicSelectAttempts = 0;
    const maxTopicSelectAttempts = 3;
    const now = moment.tz('Asia/Seoul');
    const today = now.format('YYYY.MM.DD');
    const yesterday = now.subtract(1, 'day').format('YYYY.MM.DD');

    try {
        const db = new sqlite3.Database('community.db', (err) => {
            if (err) throw new Error(`DB 연결 오류: ${err.message}`);
        });

        let kboData = null;
        let weatherData = null;

        while (topicSelectAttempts < maxTopicSelectAttempts) {
            prompt = generatePostSelect();
            topicSelectAttempts++;

            const recentPosts = await new Promise((resolve, reject) => {
                db.all(
                    'SELECT title, content FROM posts WHERE topic = ? AND created_at >= datetime("now", "-3 days") LIMIT 10',
                    [prompt],
                    (err, rows) => {
                        if (err) reject(err);
                        else resolve(rows);
                    }
                );
            });

            console.log('recentPosts', recentPosts);

            if (prompt === '주제: 야구') {
                try {
                    win.webContents.send('update-status', Buffer.from(`KBO 스크래핑 시작: ${today}, ${yesterday}`, 'utf8').toString('utf8'));
                    kboData = await scrapeKboResults(win, today, yesterday);
                    win.webContents.send('update-status', Buffer.from(`kboData: ${JSON.stringify(kboData)}`, 'utf8').toString('utf8'));
                    if (!kboData.todayGames.length && !kboData.yesterdayGames.length) {
                        win.webContents.send('update-status', Buffer.from('KBO 데이터 없음: todayGames 및 yesterdayGames 비어 있음', 'utf8').toString('utf8'));
                        continue;
                    }
                } catch (error) {
                    win.webContents.send('update-status', Buffer.from(`KBO 스크래핑 오류: ${error.message}, 스택: ${error.stack}`, 'utf8').toString('utf8'));
                    continue;
                }
            } else if (prompt === '주제: 날씨') {
                try {
                    win.webContents.send('update-status', Buffer.from(`날씨 스크래핑 시작: ${today}, ${yesterday}`, 'utf8').toString('utf8'));
                    weatherData = await scrapeWeatherResults(win, today, yesterday);
                    win.webContents.send('update-status', Buffer.from(`weatherData: ${JSON.stringify(weatherData)}`, 'utf8').toString('utf8'));
                    if (!weatherData || !weatherData.current || !weatherData.current.length) {
                        win.webContents.send('update-status', Buffer.from('날씨 데이터 없음: current 데이터 비어 있음', 'utf8').toString('utf8'));
                        weatherData = { current: [], airQuality: { fineDust: '알 수 없음', ultraFineDust: '알 수 없음' } };
                        continue;
                    }
                } catch (error) {
                    win.webContents.send('update-status', Buffer.from(`날씨 스크래핑 오류: ${error.message}, 스택: ${error.stack}`, 'utf8').toString('utf8'));
                    weatherData = { current: [], airQuality: { fineDust: '알 수 없음', ultraFineDust: '알 수 없음' } };
                    continue;
                }
            } else if (prompt === '주제: 야구와 날씨 조합') {
                try {
                    win.webContents.send('update-status', Buffer.from(`KBO 및 날씨 스크래핑 시작: ${today}, ${yesterday}`, 'utf8').toString('utf8'));
                    kboData = await scrapeKboResults(win, today, yesterday);
                    weatherData = await scrapeWeatherResults(win, today, yesterday);
                    win.webContents.send('update-status', Buffer.from(`kboData: ${JSON.stringify(kboData)}, weatherData: ${JSON.stringify(weatherData)}`, 'utf8').toString('utf8'));
                    if (!kboData.todayGames.length && !kboData.yesterdayGames.length) {
                        win.webContents.send('update-status', Buffer.from('KBO 데이터 없음: todayGames 및 yesterdayGames 비어 있음', 'utf8').toString('utf8'));
                        continue;
                    }
                    if (!weatherData || !weatherData.current || !weatherData.current.length) {
                        win.webContents.send('update-status', Buffer.from('날씨 데이터 없음: current 데이터 비어 있음', 'utf8').toString('utf8'));
                        weatherData = { current: [], airQuality: { fineDust: '알 수 없음', ultraFineDust: '알 수 없음' } };
                    }
                } catch (error) {
                    win.webContents.send('update-status', Buffer.from(`스크래핑 오류: ${error.message}, 스택: ${error.stack}`, 'utf8').toString('utf8'));
                    continue;
                }
            }

            if (!promptModules[prompt]) {
                throw new Error(`지원하지 않는 주제: ${prompt}`);
            }

            const promptText = promptModules[prompt].generatePrompt(win, now, recentPosts, kboData, prompt.includes('날씨') ? weatherData : null);

            if (!promptText) {
                throw new Error('promptText가 생성되지 않음');
            }

            const requestBody = {
                temperature: 2.0,
                top_p: 0.7,
                max_tokens: 100,
                model: "grok-3"
            };

            let attempts = 0;
            const maxAttempts = 3;
            let response;
            let post;

            while (attempts < maxAttempts) {
                try {
                    let promptTextWithDuplicate = promptText;
                    if (attempts > 0 && post) {
                        promptTextWithDuplicate += `\n- 이전 중복 글: {title: "${post.title}", content: "${post.content}"}\n- 이와 다른 제목과 내용으로 생성.`;
                    }

                    if (!promptTextWithDuplicate) {
                        throw new Error('promptTextWithDuplicate가 비어 있음');
                    }

                    response = await axios.post(
                        'https://api.x.ai/v1/chat/completions',
                        {
                            ...requestBody,
                            messages: [{ role: "user", content: promptTextWithDuplicate }]
                        },
                        {
                            headers: {
                                'Authorization': `Bearer ${process.env.XAI_API_TOKEN}`,
                                'Content-Type': 'application/json',
                            },
                            timeout: 15000
                        }
                    );

                    const rawContent = response.data.choices[0].message.content;
                    win.webContents.send('update-status', Buffer.from(`API 응답 원본: ${rawContent}`, 'utf8').toString('utf8'));

                    if (!rawContent || rawContent.length < 10 || rawContent.length > 500) {
                        throw new Error('API 응답이 비어 있거나 비정상적인 길이');
                    }

                    const jsonContent = rawContent
                        .replace(/```json\n|```|\n|\r/g, '')
                        .replace(/\s+/g, ' ')
                        .trim();

                    win.webContents.send('update-status', Buffer.from(`정리된 JSON: ${jsonContent}`, 'utf8').toString('utf8'));

                    let parsed;
                    try {
                        parsed = JSON.parse(jsonContent);
                        if (!Array.isArray(parsed)) {
                            parsed = [parsed];
                        }
                        if (parsed.length !== 1 || !parsed[0].title || !parsed[0].content) {
                            throw new Error('잘못된 JSON 구조: 단일 객체 배열이 아님 또는 title/content 누락');
                        }
                        post = parsed[0];
                    } catch (parseError) {
                        win.webContents.send('update-status', Buffer.from(`JSON 파싱 오류: ${parseError.message}`, 'utf8').toString('utf8'));
                        throw parseError;
                    }

                    let duplicateAttempts = 0;
                    const maxDuplicateAttempts = 3;
                    while (duplicateAttempts < maxDuplicateAttempts) {
                        const isDuplicate = await checkDuplicatePost(db, post.title, post.content, prompt);
                        if (!isDuplicate) {
                            break;
                        }
                        win.webContents.send('update-status', Buffer.from(`중복 게시글 감지, 재생성 시도 (${duplicateAttempts + 1}/${maxDuplicateAttempts})`, 'utf8').toString('utf8'));

                        promptTextWithDuplicate = promptText + `\n- 이전 중복 글: {title: "${post.title}", content: "${post.content}"}\n- 이와 다른 제목과 내용으로 생성.`;
                        if (!promptTextWithDuplicate) {
                            throw new Error('promptTextWithDuplicate가 비어 있음');
                        }

                        response = await axios.post(
                            'https://api.x.ai/v1/chat/completions',
                            {
                                ...requestBody,
                                messages: [{ role: "user", content: promptTextWithDuplicate }]
                            },
                            {
                                headers: {
                                    'Authorization': `Bearer ${process.env.XAI_API_TOKEN}`,
                                    'Content-Type': 'application/json',
                                },
                                timeout: 15000
                            }
                        );

                        const retryRawContent = response.data.choices[0].message.content;
                        win.webContents.send('update-status', Buffer.from(`재시도 API 응답: ${retryRawContent}`, 'utf8').toString('utf8'));

                        const retryJsonContent = retryRawContent
                            .replace(/```json\n|```|\n|\r/g, '')
                            .replace(/\s+/g, ' ')
                            .trim();

                        try {
                            parsed = JSON.parse(retryJsonContent);
                            if (!Array.isArray(parsed) || parsed.length !== 1 || !parsed[0].title || !parsed[0].content) {
                                throw new Error('재시도 JSON 구조 오류');
                            }
                            post = parsed[0];
                        } catch (parseError) {
                            duplicateAttempts++;
                            if (duplicateAttempts === maxDuplicateAttempts) {
                                throw new Error('중복 게시글 재생성 실패');
                            }
                            continue;
                        }
                    }

                    break;
                } catch (error) {
                    attempts++;
                    win.webContents.send('update-status', Buffer.from(`API 호출 오류 (시도 ${attempts}/${maxAttempts}): ${error.message}`, 'utf8').toString('utf8'));
                    if (error.response) {
                        win.webContents.send('update-status', Buffer.from(`서버 응답: ${JSON.stringify(error.response.data)}`, 'utf8').toString('utf8'));
                    }
                    if (attempts === maxAttempts) throw error;
                }
            }

            if (post) {
                if (Math.random() < 0.5) {
                    post.title = post.title.replace(/[ㅎㅎㅋㅋㅋㅠㅠ...ㄲㅈ]/g, '');
                    post.content = post.content.replace(/[ㅎㅎㅋㅋㅋㅠㅠ...ㄲㅈ]/g, '');
                }

                const userId = getRandomUserId();
                const topic = prompt;
                win.webContents.send('update-status', Buffer.from(`게시글 생성 완료: ${JSON.stringify(post)}`, 'utf8').toString('utf8'));
                db.close();
                return { ...post, topic, userId };
            }

            if (topicSelectAttempts === maxTopicSelectAttempts) {
                throw new Error('유효한 주제 선택 실패');
            }
        }

        throw new Error('주제 선택 루프에서 예상치 못한 종료');
    } catch (error) {
        win.webContents.send('update-status', Buffer.from(`${prompt} 오류: ${error.message}`, 'utf8').toString('utf8'));
        throw error;
    }
};

module.exports = { generatePostSelect, fetchPostsFromXAI };