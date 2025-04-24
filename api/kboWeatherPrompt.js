const moment = require('moment-timezone');

const generatePrompt = (win, now, recentPosts, kboData, weatherData) => {
    const nowMoment = moment.tz('Asia/Seoul');
    const nowFormatted = now.format('HH:mm');

    // weatherData null 체크
    if (!weatherData || !weatherData.current || !weatherData.current.length) {
        win.webContents.send('update-status', Buffer.from('날씨 데이터 없음: 기본 문구 생성', 'utf8').toString('utf8'));
        weatherData = { current: [], airQuality: { fineDust: '알 수 없음', ultraFineDust: '알 수 없음' } };
    }

    // kboData 체크
    const usedTeams = recentPosts.flatMap(post => post.title.match(/(두산|키움|KIA|삼성|한화|롯데|LG|NC|KT|SSG)/)?.[0]).filter(Boolean);
    const usedLocations = recentPosts.flatMap(post => post.content.match(/(고척|잠실|사직|대구|수원|광주|대전|창원|문학)/)?.[0]).filter(Boolean);
    let game = kboData.todayGames.find(g => g.status === '경기중' && !usedTeams.includes(g.homeTeam) && !usedTeams.includes(g.awayTeam) && !usedLocations.includes(g.location)) ||
               kboData.todayGames.filter(g => g.status === '예정' && !usedTeams.includes(g.homeTeam) && !usedTeams.includes(g.awayTeam) && !usedLocations.includes(g.location)).sort((a, b) => {
                   const timeA = moment.tz(`${a.date} ${a.gameTime}`, 'YYYY.MM.DD HH:mm', 'Asia/Seoul');
                   const timeB = moment.tz(`${b.date} ${b.gameTime}`, 'YYYY.MM.DD HH:mm', 'Asia/Seoul');
                   return Math.abs(timeA - nowMoment) - Math.abs(timeB - nowMoment);
               })[0] ||
               kboData.todayGames.find(g => !usedTeams.includes(g.homeTeam) && !usedTeams.includes(g.awayTeam) && !usedLocations.includes(g.location)) ||
               kboData.yesterdayGames.find(g => !usedTeams.includes(g.homeTeam) && !usedTeams.includes(g.awayTeam) && !usedLocations.includes(g.location));
    if (!game) {
        win.webContents.send('update-status', Buffer.from('게임 데이터 없음: 기본 문구 생성', 'utf8').toString('utf8'));
        game = { homeTeam: '알 수 없음', awayTeam: '알 수 없음', gameTime: '미정', status: '예정', isCanceled: false, location: '미정' };
    }

    // 랜덤 팀 선택
    const availableTeams = [game.homeTeam, game.awayTeam].filter(team => !usedTeams.includes(team));
    const selectedTeam = availableTeams.length > 0 ? availableTeams[Math.floor(Math.random() * availableTeams.length)] : [game.homeTeam, game.awayTeam][Math.floor(Math.random() * 2)];

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

    const statusText = game.isCanceled ? '경기 취소됨' :
                      game.status === '경기중' ? `현재 ${game.awayScore}:${game.homeScore}` :
                      game.status === '종료' ? `최종 ${game.awayScore}:${game.homeScore}` :
                      `곧 시작`;

    // 최근 글에서 키워드 추출
    const recentKeywords = recentPosts.flatMap(post => post.title.split(/\s+/).concat(post.content.split(/\s+/)))
        .filter(word => word.length > 2 && !['오늘', '경기', '시작', '고척', '잠실', '18:30', '14:00', '16:00', '날씨'].includes(word));

    const mood = Math.random();
    const moodType = mood < 0.5 ? '유쾌' : mood < 0.8 ? '감성적' : '도발적';
    const toneInstruction = game.status === '예정' ? '미래형 문구(곧, 예정, 기대)와 설레는 팬 톤, 현재형(뜨겁다, 화끈) 피하기' :
                           game.status === '경기중' ? '현재형 문구와 열정적인 실시간 응원 톤, 점수 반영' :
                           game.status === '종료' ? '과거형 문구와 점수/투수 반영한 팬 톤' :
                           '취소 상황에 맞는 아쉬운 톤, 다음 기회 강조';

    const promptText = `
        다음 야구와 날씨 데이터를 기반으로 자연스러운 한국어 문장 생성:
        - 기준 팀: ${selectedTeam}
        - 경기 날짜: ${game.date || '미정'}
        - 홈팀: ${game.homeTeam}
        - 원정팀: ${game.awayTeam}
        - 경기 상태: ${statusText}
        - 경기 장소: ${game.location || '미정'}
        - 온도 기반 감정: ${tempMood}
        - 미세먼지 기반 감정: ${dustMood}
        - 미세먼지: ${fineDust}
        - 초미세먼지: ${ultraFineDust}
        - 현재 시간: ${nowFormatted}
        제약:
        - 제목: 1~20자, 팀과 경기 장소 반영, 시간(예: 18:30, 14:00)과 도시명/온도(숫자) 언급 피하기, 날씨 상태(예: 맑음)나 미세먼지(예: 깨끗) 간접 반영, ${toneInstruction}.
        - 내용: 5~30자, 경기 장소와 날씨/미세먼지 기반 감성(예: 맑아서 응원, 뿌연데 마스크) 반영, 시간과 도시명/온도(숫자) 피하기, 타이틀 키워드 연계, ${toneInstruction}.
        - 말투: ${moodType}, 한국어 대화체, 팬처럼 열정적인 톤, 타이틀과 내용 동일 톤 유지.
        - 감정 표현: 50% 확률로 ㅎㅎ, ㅋㅋㅋ, ㅠㅠ, ..., ㄲㅈ 중 하나, 이모티콘 금지.
        - JSON: [{"title": "", "content": ""}] (단일 게시글).
        - 최근 글: ${JSON.stringify(recentPosts)}
        - 최근 글의 키워드(${recentKeywords.join(', ')})를 피하고, 모든 KBO 10개 팀과 장소 균등 반영, 새로운 스타일로 생성.
    `;
    win.webContents.send('update-status', Buffer.from(`야구와 날씨 프롬프트 생성: ${promptText.substring(0, 100)}...`, 'utf8').toString('utf8'));
    return promptText;
};

module.exports = { generatePrompt };