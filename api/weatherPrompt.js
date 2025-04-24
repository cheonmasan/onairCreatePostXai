const moment = require('moment-timezone');

const generatePrompt = (win, now, recentPosts, weatherData) => {
    const nowMoment = moment.tz('Asia/Seoul');
    const nowFormatted = now.format('HH:mm');

    // weatherData null 체크
    if (!weatherData || !weatherData.current || !weatherData.current.length) {
        win.webContents.send('update-status', Buffer.from('날씨 데이터 없음: 기본 문구 생성', 'utf8').toString('utf8'));
        weatherData = { current: [], airQuality: { fineDust: '알 수 없음', ultraFineDust: '알 수 없음' } };
    }

    // 랜덤 도시 선택, 도시명은 출력 안 함
    const cities = weatherData.current.length > 0 ? weatherData.current : [{ temperature: 20, condition: '알 수 없음', airQuality: { fineDust: '알 수 없음', ultraFineDust: '알 수 없음' } }];
    const selectedCity = cities[Math.floor(Math.random() * cities.length)];
    const { temperature, condition, airQuality } = selectedCity;
    const fineDust = airQuality?.fineDust || '알 수 없음';
    const ultraFineDust = airQuality?.ultraFineDust || '알 수 없음';

    // 온도 기반 감성 표현
    const tempMood = temperature < 10 ? '쌀쌀한' : temperature < 20 ? '선선한' : temperature < 25 ? '딱 좋은' : '더운';
    // 미세먼지 기반 표현
    const dustMood = fineDust.includes('좋음') ? '맑고 깨끗한' : fineDust.includes('나쁨') ? '뿌연' : '그냥저냥';

    // 최근 글에서 키워드 추출
    const recentKeywords = recentPosts.flatMap(post => post.title.split(/\s+/).concat(post.content.split(/\s+/)))
        .filter(word => word.length > 2 && !['오늘', '날씨', '맑음', '구름', '좋네'].includes(word));

    const mood = Math.random();
    const moodType = mood < 0.5 ? '유쾌' : mood < 0.8 ? '감성적' : '도발적';

    const promptText = `
        다음 날씨 데이터를 기반으로 자연스러운 한국어 문장 생성:
        - 날씨 상태: ${condition}
        - 온도 기반 감정: ${tempMood}
        - 미세먼지 기반 감정: ${dustMood}
        - 미세먼지: ${fineDust}
        - 초미세먼지: ${ultraFineDust}
        - 현재 시간: ${nowFormatted}
        제약:
        - 제목: 1~20자, 도시명과 온도(숫자) 언급 피하기, 날씨 상태(예: 맑음, 구름많음)나 미세먼지 기반 감성 표현(예: 좋네, 뿌연) 반영, ${moodType} 톤.
        - 내용: 5~30자, 도시명과 온도(숫자) 언급 피하기, 날씨 상태나 미세먼지 기반 활동(예: 산책, 마스크) 제안, 타이틀과 동일 톤 유지, ${moodType}.
        - 말투: ${moodType}, 한국어 대화체, 팬처럼 캐주얼하고 열정적인 톤.
        - 감정 표현: 50% 확률로 ㅎㅎ, ㅋㅋㅋ, ㅠㅠ, ..., ㄲㅈ 중 하나, 이모티콘 금지.
        - JSON: [{"title": "", "content": ""}] (단일 게시글).
        - 최근 글: ${JSON.stringify(recentPosts)}
        - 최근 글의 키워드(${recentKeywords.join(', ')})를 피하고, 새로운 스타일로 생성.
    `;
    win.webContents.send('update-status', Buffer.from(`날씨 프롬프트 생성: ${promptText.substring(0, 100)}...`, 'utf8').toString('utf8'));
    return promptText;
};

module.exports = { generatePrompt };