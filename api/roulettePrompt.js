const moment = require('moment-timezone');

const generatePrompt = (win, now, recentPosts) => {
    const nowMoment = moment.tz('Asia/Seoul');
    const nowFormatted = now.format('HH:mm');

    // 허용된 포인트 값과 표현
    const points = [
        { value: 1000, display: '천포' },
        { value: 3000, display: '3천포' },
        { value: 5000, display: '5천포' },
        { value: 7000, display: '7천포' },
        { value: 10000, display: '만포' }
    ];
    const selectedPoint = points[Math.floor(Math.random() * points.length)];

    // 최근 글에서 키워드 추출
    const recentKeywords = recentPosts.flatMap(post => post.title.split(/\s+/).concat(post.content.split(/\s+/)))
        .filter(word => word.length > 2 && !['포인트', '노려', '대박'].includes(word));

    const mood = Math.random();
    const moodType = mood < 0.5 ? '유쾌' : mood < 0.8 ? '감성적' : '도발적';

    const promptText = `
        다음 룰렛 이벤트 데이터를 기반으로 자연스러운 한국어 문장 생성:
        - 포인트: ${selectedPoint.display} (${selectedPoint.value})
        - 현재 시간: ${nowFormatted}
        제약:
        - 제목: 1~20자, 룰렛 이벤트 반영, 포인트(${selectedPoint.display}) 언급 가능.
        - 내용: 5~30자, 포인트(${selectedPoint.display}) 반영, 이벤트 참여 독려, 천포/만포 같은 대화체 사용.
        - 말투: ${moodType}, 한국어 대화체, 이벤트 참여자처럼 설레는 톤.
        - 감정 표현: 50% 확률로 ㅎㅎ, ㅋㅋㅋ, ㅠㅠ, ..., ㄲㅈ 중 하나, 이모티콘 금지.
        - JSON: [{"title": "", "content": ""}] (단일 게시글).
        - 최근 글: ${JSON.stringify(recentPosts)}
        - 최근 글의 키워드(${recentKeywords.join(', ')})를 피하고, 완전히 새로운 스타일로 생성.
    `;
    win.webContents.send('update-status', Buffer.from(`룰렛 프롬프트 생성: ${promptText.substring(0, 100)}...`, 'utf8').toString('utf8'));
    return promptText;
};

module.exports = { generatePrompt };