const moment = require('moment-timezone');

const generatePrompt = (win, now, recentPosts) => {
    const nowMoment = moment.tz('Asia/Seoul');
    const nowFormatted = now.format('HH:mm');

    // 방송자: 마초, 초코만
    const broadcasters = ['마초', '초코'];
    const selectedBroadcaster = broadcasters[Math.floor(Math.random() * broadcasters.length)];

    // 허용된 게임 이름
    const games = ['멀린', '슈가러쉬', '로켓블라스트', '맘모스'];
    const selectedGame = games[Math.floor(Math.random() * games.length)];

    // 최근 글에서 키워드 추출
    const recentKeywords = recentPosts.flatMap(post => post.title.split(/\s+/).concat(post.content.split(/\s+/)))
        .filter(word => word.length > 2 && !['방송', '라이브', '초코', '마초'].includes(word));

    const mood = Math.random();
    const moodType = mood < 0.5 ? '유쾌' : mood < 0.8 ? '감성적' : '도발적';

    const promptText = `
        다음 유튜브 방송 데이터를 기반으로 자연스러운 한국어 문장 생성:
        - 방송자: ${selectedBroadcaster}
        - 게임: ${selectedGame}
        - 현재 시간: ${nowFormatted}
        제약:
        - 제목: 1~20자, 방송자 반영, 게임이나 방송 분위기 언급 가능.
        - 내용: 5~30자, 방송자나 게임 반영, 시청 독려.
        - 말투: ${moodType}, 한국어 대화체, 팬처럼 신나는 톤.
        - 감정 표현: 50% 확률로 ㅎㅎ, ㅋㅋㅋ, ㅠㅠ, ..., ㄲㅈ 중 하나, 이모티콘 금지.
        - JSON: [{"title": "", "content": ""}] (단일 게시글).
        - 최근 글: ${JSON.stringify(recentPosts)}
        - 최근 글의 키워드(${recentKeywords.join(', ')})를 피하고, 완전히 새로운 스타일로 생성.
    `;
    win.webContents.send('update-status', Buffer.from(`유튜브 프롬프트 생성: ${promptText.substring(0, 100)}...`, 'utf8').toString('utf8'));
    return promptText;
};

module.exports = { generatePrompt };