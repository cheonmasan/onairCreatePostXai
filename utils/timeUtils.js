const moment = require('moment-timezone');

const getKST = () => moment().tz('Asia/Seoul').format('A h시 mm분');
const getDay = () => moment().tz('Asia/Seoul').format('YYYY년 MM월 DD일');
const getDaySub = () => moment().subtract(1, 'days').tz('Asia/Seoul').format('YYYY년 MM월 DD일');

module.exports = { getKST, getDay, getDaySub, moment };