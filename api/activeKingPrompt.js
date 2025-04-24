const generatePrompt = (win, now, recentPosts) => {
    const nowFormatted = now.format('HH:mm');

    // 최근 글에서 키워드 추출
    const recentKeywords = recentPosts.flatMap(post => post.title.split(/\s+/).concat(post.content.split(/\s+/)))
        .filter(word => word.length > 2 && !['활동왕', '축하', '만포', '대박'].includes(word));

    const mood = Math.random();
    const moodType = mood < 0.5 ? '유쾌' : mood < 0.8 ? '감성적' : '도발적';

    const promptText = `
        활동왕 이벤트 당첨 축하 기반 자연스러운 한국어 문장 생성:
        - 이벤트: 매주 수~화 자유게시판, 댓글, 잭팟 영상, 슬롯 리뷰 활동 점수로 1~3등 선정
        - 보상: 1등 3만포, 2등 2만포, 3등 1만포
        - 시간: ${nowFormatted}, 수요일 당첨 발표
        제약:
        - 제목: 1~20자, 당첨 축하 반영 (예: "활동왕 대박 축하!"), 시간/포인트 숫자 직접 언급 피하기.
        - 내용: 5~30자, 당첨 축하 및 보상 간접 언급 (예: "3만포 겟! 대박이야 ㅋㅋ"), 시간 피하기.
        - 말투: ${moodType}, 한국어 대화체, 사이트 팬덤처럼 열정적.
        - 감정 표현: 50% 확률로 ㅎㅎ, ㅋㅋㅋ, ㅠㅠ, ..., ㄲㅈ 중 하나, 이모티콘 금지.
        - JSON: [{"title": "", "content": ""}] (단일 게시글).
        - 최근 글: ${JSON.stringify(recentPosts)}
        - 최근 키워드(${recentKeywords.join(', ')}) 피하고, 새로운 스타일 생성.
    `;
    win.webContents.send('update-status', Buffer.from(`활동왕 프롬프트 생성: ${promptText.substring(0, 100)}...`, 'utf8').toString('utf8'));
    return promptText;
};

module.exports = { generatePrompt };