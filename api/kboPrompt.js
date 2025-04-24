const moment = require('moment-timezone');

const generatePrompt = (win, now, recentPosts, kboData) => {
    const nowMoment = moment.tz('Asia/Seoul');
    const nowFormatted = now.format('HH:mm');

    // 경기 랜덤 선택, 직전 사용 팀/장소 제외
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
        win.webContents.send('update-status', Buffer.from('게임 데이터 없음: 선택 가능한 경기가 없음', 'utf8').toString('utf8'));
        throw new Error('게임 데이터 없음');
    }

    // 랜덤 팀 선택
    const validTeams = ['두산', '키움', 'KIA', '삼성', '한화', '롯데', 'LG', 'NC', 'KT', 'SSG'];
    const availableTeams = [game.homeTeam, game.awayTeam].filter(team => !usedTeams.includes(team) && validTeams.includes(team));
    const selectedTeam = availableTeams.length > 0 ? availableTeams[Math.floor(Math.random() * availableTeams.length)] : [game.homeTeam, game.awayTeam][Math.floor(Math.random() * 2)];
    if (!selectedTeam || !validTeams.includes(selectedTeam)) {
        win.webContents.send('update-status', Buffer.from(`잘못된 팀명: ${selectedTeam}`, 'utf8').toString('utf8'));
        throw new Error('기준 팀 선택 실패');
    }

    const gameTime = moment.tz(`${game.date} ${game.gameTime}`, 'YYYY.MM.DD HH:mm', 'Asia/Seoul');
    if (game.status === '예정' && gameTime.isAfter(nowMoment)) {
        game.homeScore = '0';
        game.awayScore = '0';
    }

    const statusText = game.isCanceled ? '경기 취소됨' :
                      game.status === '경기중' ? `현재 ${game.awayScore}:${game.homeScore}` :
                      game.status === '종료' ? `최종 ${game.awayScore}:${game.homeScore}` :
                      `곧 시작`;

    // 최근 글에서 키워드 추출
    const recentKeywords = recentPosts.flatMap(post => post.title.split(/\s+/).concat(post.content.split(/\s+/)))
        .filter(word => word.length > 2 && !['오늘', '경기', '시작', '고척', '잠실', '18:30', '14:00', '16:00'].includes(word));

    const mood = Math.random();
    const moodType = mood < 0.5 ? '유쾌' : mood < 0.8 ? '감성적' : '도발적';
    const cheers = ['화이팅!', '승리 가자!', '팬들 열기 뜨겁다!', '오늘 대박!'];
    const toneInstruction = game.status === '예정' ? '미래형 문구(곧, 예정, 기대, 각오, 열기)와 설레는 팬 톤, 다양한 응원 스타일, 현재형(뜨겁다, 화끈) 피하기' :
                           game.status === '경기중' ? '현재형 문구와 열정적인 실시간 응원 톤, 점수 반영, 다양한 응원 스타일' :
                           game.status === '종료' ? '과거형 문구와 점수/투수 반영한 팬 톤, 다양한 감정 표현' :
                           '취소 상황에 맞는 아쉬운 톤, 다음 기회 강조, 희망적 메시지';

    const promptText = `
        다음 KBO 경기 데이터를 기반으로 자연스러운 한국어 문장 생성:
        - 기준 팀: ${selectedTeam}
        - 경기 날짜: ${game.date}
        - 홈팀: ${game.homeTeam}
        - 원정팀: ${game.awayTeam}
        - 경기 상태: ${statusText}
        - 홈팀 점수: ${game.homeScore}
        - 원정팀 점수: ${game.awayScore}
        - 홈팀 투수: ${game.pitcherHome || '미정'}
        - 원정팀 투수: ${game.pitcherAway || '미정'}
        - 경기 장소: ${game.location || '미정'}
        - 현재 시간: ${nowFormatted}
        - 추가 문구: ${cheers[Math.floor(Math.random() * cheers.length)]}
        제약:
        - 제목: 1~20자, 기준 팀 또는 경기 장소 선택적 반영, 시간(예: 18:30, 14:00) 언급 피하기, ${toneInstruction}.
        - 내용: 5~30자, 경기 장소 또는 상태 선택적 반영, 시간 언급 피하기, 타이틀의 키워드 연계 가능, 추가 문구 반영, ${toneInstruction}.
        - 말투: ${moodType}, 한국어 대화체, KBO 팬처럼 열정적으로, 타이틀과 내용 동일 톤 유지.
        - 감정 표현: 50% 확률로 ㅎㅎ, ㅋㅋㅋ, ㅠㅠ, ..., ㄲㅈ 중 하나, 이모티콘 금지.
        - JSON: [{"title": "", "content": ""}] (단일 게시글).
        - 최근 글: ${JSON.stringify(recentPosts)}
        - 최근 글의 키워드(${recentKeywords.join(', ')})를 피하고, 모든 KBO 10개 팀과 장소 균등 반영, 새로운 스타일로 생성.
    `;
    win.webContents.send('update-status', Buffer.from(`야구 프롬프트 생성: ${promptText.substring(0, 100)}...`, 'utf8').toString('utf8'));
    return promptText;
};

module.exports = { generatePrompt };